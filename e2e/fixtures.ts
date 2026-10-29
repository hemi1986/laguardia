import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * The Vercel deployment protection bypass header goes only to requests for the preview itself,
 * never to other origins the page may contact. Every page needs it – the test's own `page` gets it from the fixture,
 * a page of another browser context (e.g. a second visitor's phone, ST-010) through this function.
 */
export async function allowPreview(page: Page, baseURL: string | undefined): Promise<void> {
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!bypass || !baseURL) return;
  await page.route(`${new URL(baseURL).origin}/**`, (route) =>
    route.continue({
      headers: {
        ...route.request().headers(),
        "x-vercel-protection-bypass": bypass,
        "x-vercel-set-bypass-cookie": "true",
      },
    }),
  );
}

/**
 * Every browser test fails when the browser reports a Content Security Policy violation (ST-070) – on any page it
 * opens, in its own context and in every context it opens beside it (a visitor's phone) – except one caused only by
 * the Vercel toolbar, which Vercel injects into previews. A test that provokes a violation on purpose sets
 * `test.use({ policyViolationsExpected: true })`.
 */
export const test = base.extend<{ policyViolationsExpected: boolean; policyWatch: void }>({
  policyViolationsExpected: [false, { option: true }],
  policyWatch: [
    async ({ browser, context, policyViolationsExpected }, provide) => {
      const violations: string[] = [];
      const watch = (watched: BrowserContext) =>
        watched.on("console", (message) => {
          const text = message.text();
          if (message.type() === "error" && text.includes("Content Security Policy") && !text.includes("vercel.live")) {
            violations.push(text);
          }
        });
      watch(context);
      const newContext = browser.newContext;
      browser.newContext = async (...options) => {
        const opened = await newContext.apply(browser, options);
        watch(opened);
        return opened;
      };
      try {
        await provide();
      } finally {
        browser.newContext = newContext;
      }
      if (!policyViolationsExpected) expect(violations, "Content Security Policy violations").toEqual([]);
    },
    { auto: true },
  ],
  page: async ({ page, baseURL }, provide) => {
    await allowPreview(page, baseURL);
    await provide(page);
  },
});

export { expect } from "@playwright/test";

/**
 * Opens "Mehr" in the team navigation (ST-008): the managing destinations live behind it. Tests that assert a
 * destination is *missing* must open it first – a closed `<details>` hides its links anyway.
 */
export async function openMore(page: import("@playwright/test").Page) {
  const more = page.getByRole("navigation").locator("details");
  if ((await more.getAttribute("open")) === null) await more.locator("summary").click();
  await expect(more).toHaveAttribute("open", "");
}

/**
 * An untriaged problem report for a machine on display, reported the way a visitor does – on a phone of its own,
 * without a team session. Browser tests arrange their untriaged problem reports this way: a technician's own problem
 * report is triaged in the same step and never waits for triage (ST-023).
 */
export async function reportAsVisitor(page: Page, museumNumber: string, description: string): Promise<void> {
  const context = await page
    .context()
    .browser()!
    .newContext({
      locale: "de-DE",
      viewport: { width: 360, height: 800 },
      isMobile: true,
    });
  const phone = await context.newPage();
  await allowPreview(phone, base.info().project.use.baseURL);
  await phone.goto(`/m/${museumNumber}/melden`);
  await phone.getByLabel("Was ist das Problem?").fill(description);
  await phone.getByRole("button", { name: "Meldung senden" }).click();
  await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}\\?`)); // stored before the test goes on
  await context.close();
}

/** An account to log in with. */
export type Account = { username: string; password: string };

/** The e2e technician each local run creates (ST-083, named „E2E Technician“) – from the environment. */
export const TECHNICIAN = "E2E Technician";

function technician(): Account {
  return { username: process.env.E2E_TEAM_USERNAME!, password: process.env.E2E_TEAM_PASSWORD! };
}

/** Logs in on `/login` – as the e2e technician unless another account is given. */
export async function logIn(page: Page, as: Account = technician()) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(as.username);
  await page.getByLabel("Passwort").fill(as.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A text no other run has used – tests share the browser tests' database and the preview's. */
export function unique(prefix: string): string {
  return `${prefix} ${uniqueSuffix()}`;
}

/** Like `unique`, without a space – for a username. */
export function uniqueId(prefix: string): string {
  return `${prefix}_${uniqueSuffix()}`;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The width the page needs – more than 360 means it scrolls sideways on a phone (G16). */
export async function pageWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/**
 * A team member created by the logged-in technician on „Neues Teammitglied“ (ST-081): named „<name> <suffix>“ when a
 * name is given, else „E2E <username>“ – what the specs that only need some helper expect.
 */
export async function aTeamMember(
  page: Page,
  { name, role = "helper" }: { name?: string; role?: "helper" | "technician" } = {},
): Promise<Account & { name: string }> {
  const username = uniqueId(role);
  const member = { name: name ? unique(name) : `E2E ${username}`, username, password: "e2e-secret-10" };
  await page.goto("/team/members/new");
  await page.getByLabel("Name", { exact: true }).fill(member.name);
  await page.getByLabel("Benutzername").fill(member.username);
  await page.getByLabel("Anfangspasswort").fill(member.password);
  await page.getByLabel("Rolle").selectOption(role);
  await page.getByRole("button", { name: "Teammitglied anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${member.name} ist angelegt.`);
  return member;
}

/** A helper account created by the logged-in technician, who is logged out afterwards. Named „E2E <username>“. */
export async function aHelper(page: Page): Promise<Account> {
  const helper = await aTeamMember(page);
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  return helper;
}

export type MachineStatus = "playable" | "limited" | "out-of-order" | "not-on-display";

/**
 * Unticks the maintenance tasks the registration form proposes for the machine model just chosen (ST-097): a machine a
 * test registers without being about its maintenance tasks gets none, so it changes neither the one maintenance plan
 * beside the specs that do nor what is due. With JavaScript the ticks follow the choice in the same task, so they are
 * there to untick when the choice returns.
 */
export async function untickMaintenanceTasks(page: Page) {
  await page
    .locator('input[name="maintenanceTaskId"]:checked')
    .evaluateAll((boxes) => boxes.forEach((box) => ((box as HTMLInputElement).checked = false)));
}

/**
 * A machine with a machine model of its own, registered by the logged-in technician – Playable unless a machine status
 * is given. Returns its museum number and the model's title.
 */
export async function aMachine(page: Page, machineStatus?: MachineStatus, location = "Hall 2") {
  const title = unique("Medieval Madness");
  await page.goto("/team/machine-models/new");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await untickMaintenanceTasks(page);
  await page.getByLabel("Standort").fill(location);
  if (machineStatus) await page.getByLabel("Status").selectOption(machineStatus);
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  return { museumNumber, title };
}

/** A new machine, retired by the logged-in technician through its machine record (ST-039). */
export async function aRetiredMachine(page: Page) {
  const machine = await aMachine(page);
  await page.goto(`/team/machines/${machine.museumNumber}`);
  await page.getByRole("link", { name: "Gerät ausmustern" }).click();
  await page.getByLabel("Grund").fill("Sold to a collector");
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Endgültig ausmustern" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${machine.museumNumber} ist ausgemustert.`);
  return machine;
}

/** A machine with an open defect, reported and recorded by the logged-in technician in one step (ST-023). */
export async function anOpenDefect(page: Page, { suitableForHelpers = false } = {}) {
  const { museumNumber } = await aMachine(page);
  const title = unique("Left flipper weak");
  await page.goto(`/team/machines/${museumNumber}/melden/defekt-erfassen`);
  await page.getByLabel("Beschreibung").fill(`${title} – first seen`);
  await page.getByLabel("Titel").fill(title);
  if (suitableForHelpers) await page.getByLabel("Für Helfer:innen geeignet").check();
  await page.getByRole("button", { name: "Melden und Defekt erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(title);
  return { museumNumber, title };
}

/** The defect's page, opened the way a team member gets there: the open defects list, narrowed to the machine. */
export async function openDefect(page: Page, museumNumber: string, title: string) {
  await page.goto(`/team/defects?machine=${museumNumber}`);
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
}

/** The one entry the open defects list has for the machine. */
export async function openDefectsEntry(page: Page, museumNumber: string) {
  await page.goto(`/team/defects?machine=${museumNumber}`);
  const entries = page.getByRole("main").getByRole("listitem");
  await expect(entries).toHaveCount(1);
  return entries;
}

/** The fold of „Geräte der Wartungsaufgabe“ (a native `<details>`) that holds that machine. */
export const groupOf = (page: Page, museumNumber: string) => page.locator("details").filter({ hasText: museumNumber });

/** Opens the fold that holds that machine – they are closed when the page opens – and returns it. */
export async function openedGroup(page: Page, museumNumber: string) {
  const group = groupOf(page, museumNumber);
  if (!(await group.evaluate((element) => (element as HTMLDetailsElement).open)))
    await group.locator("summary").click();
  return group;
}

/** Ticks these machines in „Geräte der Wartungsaufgabe“, opening the group each is in. */
export async function tickMachines(page: Page, ...machines: { museumNumber: string }[]) {
  for (const { museumNumber } of machines) {
    await openedGroup(page, museumNumber);
    await page.getByRole("checkbox", { name: new RegExp(museumNumber) }).check();
  }
}

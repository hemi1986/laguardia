import type { Page } from "@playwright/test";
import { expect, openMore, test } from "./fixtures";

/**
 * A technician reports a problem and records a defect in the same step on a phone (ST-023, G21a): machine record →
 * „Problem melden“ → the choice of the triage outcome → the form „Problem melden und Defekt erfassen“ → back on the
 * machine record. Helpers keep the plain report form (ST-015). Needs the e2e technician each local run creates
 * (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function logIn(page: Page, as = { username: username!, password: password! }) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(as.username);
  await page.getByLabel("Passwort").fill(as.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

type MachineStatus = "playable" | "limited" | "out-of-order" | "not-on-display";

/** A machine with the given status, registered by the e2e technician. Returns its museum number and model title. */
async function aMachine(page: Page, machineStatus: MachineStatus = "playable") {
  const title = unique("Medieval Madness");
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 2");
  await page.getByLabel("Status").selectOption(machineStatus);
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  return { museumNumber, title };
}

/** A helper account created by the e2e technician, who then logs out. */
async function aHelper(page: Page) {
  const helper = { username: unique("helper").replace(" ", "_"), password: "e2e-secret-10" };
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${helper.username}`);
  await page.getByLabel("Benutzername").fill(helper.username);
  await page.getByLabel("Anfangspasswort").fill(helper.password);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  return helper;
}

/** From the machine record to the choice of the triage outcome, the way a team member starts reporting. */
async function startReporting(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  await page.getByRole("link", { name: "Problem melden" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Problem melden · ${museumNumber}`);
}

/** The form „Problem melden und Defekt erfassen“, opened the way a technician gets there. */
async function openForm(page: Page, museumNumber: string) {
  await startReporting(page, museumNumber);
  await page.getByRole("link", { name: "Defekt erfassen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Problem melden und Defekt erfassen · ${museumNumber}`,
  );
}

const status = (page: Page) => page.getByLabel("Status", { exact: true });
const send = (page: Page) => page.getByRole("button", { name: "Melden und Defekt erfassen" });

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/** Nothing was stored for the machine: no defect with that title is open, and nothing of the machine waits for triage. */
async function expectNothingStored(page: Page, museumNumber: string, defectTitle?: string) {
  await page.goto("/team/defects");
  if (defectTitle) await expect(page.getByRole("main")).not.toContainText(defectTitle);
  await expect(page.getByRole("main")).not.toContainText(museumNumber);
  await page.goto("/team/triage");
  await expect(page.getByRole("main")).not.toContainText(museumNumber);
}

test("ST-023: Technicians are offered recording a defect when reporting", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page);

  await startReporting(page, museumNumber);

  const main = page.getByRole("main");
  await expect(main).toContainText(`${museumNumber} · ${title}`);
  await expect(main.getByRole("heading", { name: "Sichten" })).toBeVisible();
  await expect(main).toContainText("Meldungen von Techniker:innen werden gleich beim Melden gesichtet.");
  await expect(main.getByRole("link", { name: "Defekt erfassen" })).toBeVisible();
  // Nothing is preselected, and nothing can be sent from here: no choice control, no description, no submit.
  await expect(main.locator("input, select, textarea, button, form")).toHaveCount(0);
  await expect(main.getByRole("alert")).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Zurück zum Gerät" })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-023: Helpers report as before", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await logIn(page, await aHelper(page));

  await startReporting(page, museumNumber);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Sichten" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Defekt erfassen" })).toHaveCount(0);
  await expect(main.getByLabel("Titel")).toHaveCount(0);
  await page.getByLabel("Beschreibung").fill("Rubber on the left slingshot cracked");
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?`));
  await expect(main.getByRole("status")).toHaveText(
    `Meldung zu ${museumNumber} erfasst – sie wartet auf die Sichtung.`,
  );
});

test("a helper who opens the form for recording a defect lands on the plain report form", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await logIn(page, await aHelper(page));

  await page.goto(`/team/machines/${museumNumber}/melden/defekt-erfassen`);

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}/melden$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Problem melden · ${museumNumber}`);
  await expect(page.getByLabel("Beschreibung")).toBeVisible();
  await expect(page.getByLabel("Titel")).toHaveCount(0);
});

test("ST-023: Only a stricter machine status when reporting", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page, "limited");

  await openForm(page, museumNumber);

  await expect(page.getByRole("main")).toContainText(`${museumNumber} ist zurzeit Eingeschränkt.`);
  await expect(status(page).locator("option")).toHaveText(["Status nicht ändern", "Außer Betrieb"]);
  await expect(status(page)).toHaveValue("");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-023: No status choice for a machine not on display", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page, "not-on-display");

  await openForm(page, museumNumber);

  await expect(status(page)).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText(
    `${museumNumber} ist schon Nicht ausgestellt – der Status bleibt.`,
  );
});

test("ST-023: Report without a description stores nothing", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  const defectTitle = unique("Left flipper sticks");
  await openForm(page, museumNumber);

  await page.getByLabel("Titel").fill(defectTitle);
  await send(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte beschreibe das Problem.");
  await expect(page.getByLabel("Beschreibung")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Titel")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Titel")).toHaveValue(defectTitle);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expectNothingStored(page, museumNumber, defectTitle);
});

test("with neither a description nor a title, the description is the one marked", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await openForm(page, museumNumber);

  await send(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte beschreibe das Problem.");
  await expect(page.getByLabel("Beschreibung")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Titel")).not.toHaveAttribute("aria-invalid", "true");
});

test("ST-023: A rejected report keeps what was typed", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await openForm(page, museumNumber);
  // The form's defaults (ST-018): no title, priority normal, not for helpers, the status unchanged.
  await expect(page.getByLabel("Titel")).toHaveValue("");
  await expect(page.getByLabel("Priorität")).toHaveValue("normal");
  await expect(page.getByLabel("Für Helfer:innen geeignet")).not.toBeChecked();
  await expect(status(page).locator("option")).toHaveText(["Status nicht ändern", "Eingeschränkt", "Außer Betrieb"]);
  await expect(status(page)).toHaveValue("");
  await expect(page.getByLabel("Grund")).toHaveCount(0);

  await page.getByLabel("Beschreibung").fill("Left flipper coil stop broken");
  await page.getByLabel("Priorität").selectOption("high");
  await page.getByLabel("Für Helfer:innen geeignet").check();
  await status(page).selectOption("out-of-order");
  await send(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Titel angeben.");
  await expect(page.getByLabel("Titel")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Beschreibung")).toHaveValue("Left flipper coil stop broken");
  await expect(page.getByLabel("Priorität")).toHaveValue("high");
  await expect(page.getByLabel("Für Helfer:innen geeignet")).toBeChecked();
  await expect(status(page)).toHaveValue("out-of-order");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expectNothingStored(page, museumNumber);
});

test("ST-023: Machine status changed in the meantime stores nothing", async ({ page, context }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page, "playable");
  const defectTitle = unique("Left flipper sticks");
  await openForm(page, museumNumber);
  await page.getByLabel("Beschreibung").fill("Left flipper coil stop broken");
  await page.getByLabel("Titel").fill(defectTitle);
  await status(page).selectOption("limited");

  // A moment ago, in another tab: the machine is set to Out of order.
  const other = await context.newPage();
  await other.goto(`/team/machines/${museumNumber}/status`);
  await other.getByLabel("Status", { exact: true }).selectOption("out-of-order");
  await other.getByLabel("Grund").fill("coil smells burnt");
  await other.getByRole("button", { name: "Status ändern" }).click();
  await expect(other.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} ist jetzt Außer Betrieb.`);
  await other.close();

  await send(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Diesen Status kann ein Defekt nicht setzen. Bitte die Seite neu laden.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `Problem melden und Defekt erfassen · ${museumNumber}`,
  );
  await expect(page.getByLabel("Beschreibung")).toHaveValue("Left flipper coil stop broken");
  await expect(page.getByLabel("Titel")).toHaveValue(defectTitle);
  // The page was rendered again with the machine as it is now: a second try does not send the stale status choice.
  await expect(page.getByRole("main")).toContainText(`${museumNumber} ist schon Außer Betrieb – der Status bleibt.`);
  await expect(status(page)).toHaveCount(0);
  await expectNothingStored(page, museumNumber, defectTitle);
});

test("ST-023: After reporting, the technician is back on the machine record", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page, "playable");
  await openForm(page, museumNumber);

  await page.getByLabel("Beschreibung").fill("Left flipper coil stop broken");
  await page.getByLabel("Titel").fill("Left flipper sticks");
  await status(page).selectOption("limited");
  await send(page).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${museumNumber} · ${title}`);
  const confirmation = page.getByRole("main").getByRole("status");
  await expect(confirmation).toHaveText(
    `Defekt „Left flipper sticks“ an ${museumNumber} erfasst. ${museumNumber} ist jetzt Eingeschränkt.`,
  );
  await expect(page.getByRole("main")).not.toContainText("wartet auf die Sichtung");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // Triaged in the same step: it never appears in the triage list.
  await page.goto("/team/triage");
  await expect(page.getByRole("main")).not.toContainText(museumNumber);
  // … and the defect is open (what the rejected forms above must not leave behind).
  await page.goto("/team/defects");
  await expect(page.getByRole("main")).toContainText(museumNumber);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a problem is reported with its defect, and a rejected form keeps what was typed", async ({ page }) => {
    await logIn(page);
    const { museumNumber } = await aMachine(page);
    await openForm(page, museumNumber);

    await page.getByLabel("Beschreibung").fill("Rubber on the left slingshot cracked");
    await page.getByLabel("Priorität").selectOption("low");
    await send(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Titel angeben.");
    await expect(page.getByLabel("Beschreibung")).toHaveValue("Rubber on the left slingshot cracked");
    await expect(page.getByLabel("Priorität")).toHaveValue("low");
    await page.getByLabel("Titel").fill("Rubber cracked");
    await send(page).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      `Defekt „Rubber cracked“ an ${museumNumber} erfasst.`,
    );
  });
});

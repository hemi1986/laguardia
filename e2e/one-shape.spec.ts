import type { Page } from "@playwright/test";
import { aMachine, anOpenDefect, aRetiredMachine, expect, logIn, openDefect, pageWidth, test, tickMachines, unique, untickMaintenanceTasks } from "./fixtures";

/**
 * Sections, lists, filters and links take one shape on every page (ST-092, G29, G30, G32, G17): two things have the
 * same shape when they are drawn with the same component – the same colours, frame, size of text and heading level –,
 * checked against a named example on the pages that already have it (the machine record's sections, „Status ändern“,
 * „Zurück zum Gerät“, the due maintenance filter's checkbox). Needs the e2e technician each local run creates (ST-083).
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password, "needs the e2e technician account");
});

/** What makes a section look like one: its frame's colours and corners, its title's heading level and type. */
async function sectionShapes(page: Page) {
  return page
    .getByRole("main")
    .locator("section")
    .evaluateAll((sections) =>
      sections.map((section) => {
        const frame = section.querySelector(":scope > [data-slot=card]");
        const title = section.querySelector("h1, h2, h3, h4");
        const style = (element: Element | null, properties: string[]) => {
          if (!element) return undefined;
          const computed = getComputedStyle(element);
          return properties.map((property) => computed.getPropertyValue(property)).join(" ");
        };
        return {
          title: title?.textContent ?? "",
          frame: style(frame, ["background-color", "border-radius", "box-shadow"]),
          heading: title && `${title.tagName} ${style(title, ["font-size", "font-weight"])}`,
        };
      }),
    );
}

/** The shape of the machine record's sections – the named example (G29). */
async function machineRecordSection(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  const [first] = await sectionShapes(page);
  expect(first.frame).toBeTruthy();
  return { frame: first.frame, heading: first.heading };
}

async function expectFramedLikeTheMachineRecord(page: Page, example: { frame?: string; heading?: string | null }) {
  const shapes = await sectionShapes(page);
  expect(shapes.length).toBeGreaterThan(0);
  for (const shape of shapes) expect({ title: shape.title, ...example }).toEqual(shape);
}

async function logWork(page: Page, museumNumber: string, title: string, whatWasDone: string) {
  await openDefect(page, museumNumber, title);
  await page.getByRole("main").getByRole("link", { name: "Arbeitsschritt eintragen" }).click();
  await page.getByLabel("Was wurde gemacht?").fill(whatWasDone);
  await page.getByRole("button", { name: "Arbeitsschritt eintragen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(title);
}

test("ST-092: The defect page is built from framed sections and headed by its title", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await logWork(page, museumNumber, title, "Checked the coil");
  await logWork(page, museumNumber, title, "Replaced the coil stop");
  const example = await machineRecordSection(page, museumNumber);

  await openDefect(page, museumNumber, title);

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(title);
  const machineLink = page.getByRole("main").getByRole("link").first();
  await expect(machineLink).toHaveText(new RegExp(`^${museumNumber} · Medieval Madness`));
  await expectFramedLikeTheMachineRecord(page, example);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

/** A maintenance task on the machine (Not on display, so nothing is ever due), recorded once from its machine record. */
async function aMaintenanceRecord(page: Page, machine: { museumNumber: string }) {
  const name = unique("Clean playfield");
  await page.goto("/team/maintenance-plan/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Anleitung").fill("Wipe the playfield.");
  await page.getByLabel("Intervall in Monaten").fill("3");
  await tickMachines(page, machine);
  await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();
  const change = page.getByRole("main").getByRole("listitem").filter({ hasText: name }).getByRole("link");
  const maintenanceTaskId = (await change.getAttribute("href"))!.split("/").pop()!;
  await page.goto(
    `/team/maintenance/erfassen?task=${maintenanceTaskId}&machine=${encodeURIComponent(machine.museumNumber)}&von=geraet`,
  );
  await page.getByLabel("Ergebnis").selectOption({ label: "Erledigt" });
  await page.getByRole("button", { name: "Wartung eintragen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Wartung an ${machine.museumNumber} eingetragen.`);
}

test("ST-092: The history pages and the repair times are built from framed sections", async ({ page }) => {
  await logIn(page);
  const machine = await aMachine(page, "not-on-display");
  const title = unique("Left flipper weak");
  await page.goto(`/team/machines/${machine.museumNumber}/melden/defekt-erfassen`);
  await page.getByLabel("Beschreibung").fill(`${title} – first seen`);
  await page.getByLabel("Titel").fill(title);
  await page.getByRole("button", { name: "Melden und Defekt erfassen" }).click();
  await aMaintenanceRecord(page, machine);
  const example = await machineRecordSection(page, machine.museumNumber);

  await page.goto(`/team/machines/${machine.museumNumber}/reparaturhistorie`);
  await expectFramedLikeTheMachineRecord(page, example);
  await page.getByRole("main").getByRole("link", { name: /^\d{4}/ }).first().click();
  await expect(page.getByRole("main")).toContainText(title);
  await expectFramedLikeTheMachineRecord(page, example);

  await page.goto(`/team/machines/${machine.museumNumber}/wartungseintraege`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Wartungseinträge · ${machine.museumNumber}`);
  await expectFramedLikeTheMachineRecord(page, example);

  await page.goto("/team/repair-times");
  await expectFramedLikeTheMachineRecord(page, example);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-092: An empty section says so in its frame", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);

  await openDefect(page, museumNumber, title);

  const workLog = page.getByRole("main").locator("section").filter({ hasText: "Arbeitsschritte" });
  await expect(workLog.getByRole("heading", { level: 2 })).toHaveText("Arbeitsschritte");
  await expect(workLog.locator("[data-slot=card]")).toContainText("Noch kein Arbeitsschritt eingetragen.");
});

const showRetired = (page: Page) => page.getByLabel("Auch ausgemusterte Geräte anzeigen");
const machineEntry = (page: Page, machine: { museumNumber: string; title: string }) =>
  page.getByRole("main").getByRole("listitem").filter({ hasText: `${machine.museumNumber} · ${machine.title}` });

test("ST-092: The retired machines filter does not need the search", async ({ page }) => {
  await logIn(page);
  const retired = await aRetiredMachine(page);
  await page.goto("/team/machines");
  await expect(page.getByLabel("Suche")).toHaveValue("");

  await showRetired(page).check();
  await page.getByRole("button", { name: "Filtern" }).click();

  await expect(page).toHaveURL(/retired=1/);
  await expect(machineEntry(page, retired)).toContainText("Ausgemustert");
  await expect(showRetired(page)).toBeChecked();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

/**
 * Two machines of one new machine model, so the model's title finds exactly them – one active, one retired – and a
 * third of another model, which the search must leave out.
 */
async function twoMachinesOfOneModel(page: Page) {
  const active = await aMachine(page);
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${active.title} (Williams)` });
  await untickMaintenanceTasks(page);
  await page.getByLabel("Standort").fill("Hall 2");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  const retired = { museumNumber, title: active.title };
  await page.goto(`/team/machines/${museumNumber}/ausmustern`);
  await page.getByLabel("Grund").fill("Sold to a collector");
  await page.getByRole("button", { name: "Gerät ausmustern" }).click();
  await page.getByRole("button", { name: "Endgültig ausmustern" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} ist ausgemustert.`);
  const other = await aMachine(page);
  return { active, retired, other };
}

test("ST-092: Filtering keeps the search", async ({ page }) => {
  await logIn(page);
  const { active, retired, other } = await twoMachinesOfOneModel(page);
  await page.goto("/team/machines");
  await page.getByLabel("Suche").fill(active.title);
  await page.getByRole("button", { name: "Suchen" }).click();

  await showRetired(page).check();
  await page.getByRole("button", { name: "Filtern" }).click();

  await expect(page).toHaveURL(/retired=1/);
  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: active.title })).toHaveCount(2);
  await expect(machineEntry(page, active)).toBeVisible();
  await expect(machineEntry(page, retired)).toContainText("Ausgemustert");
  await expect(machineEntry(page, other)).toHaveCount(0);
  await expect(page.getByLabel("Suche")).toHaveValue(active.title);
});

test("ST-092: Searching keeps the filter", async ({ page }) => {
  await logIn(page);
  const { active, retired, other } = await twoMachinesOfOneModel(page);
  await page.goto("/team/machines");
  await showRetired(page).check();
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(/retired=1/);

  await page.getByLabel("Suche").fill(active.title);
  await page.getByRole("button", { name: "Suchen" }).click();

  await expect(page).toHaveURL(/search=/);
  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: active.title })).toHaveCount(2);
  await expect(machineEntry(page, active)).toBeVisible();
  await expect(machineEntry(page, retired)).toContainText("Ausgemustert");
  await expect(machineEntry(page, other)).toHaveCount(0);
  await expect(showRetired(page)).toBeChecked();
});

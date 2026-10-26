import type { Page } from "@playwright/test";
import { aMachine, expect, logIn, pageWidth, test, unique } from "./fixtures";

/**
 * Choosing the machines of a new maintenance task on a phone (ST-094, G27): „Geräte der Wartungsaufgabe“ in groups
 * that fold – native, so they open without JavaScript – with „Alle auswählen“ only when JavaScript runs. A rejection
 * keeps the choice and opens the groups with a choice in them. The machines are Not on display, so no task is due
 * because of these tests (`due-maintenance.spec.ts`). The groups, their order and the empty case are tested on the
 * page's data (`maintenance-plan/new/machine-choice.integration.test.ts`). Needs the e2e technician each local run
 * creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** A machine of a machine model of its own with that machine category and technology – Not on display. */
async function anArcadeMachine(page: Page) {
  const title = unique("Galaxian");
  await page.goto("/team/machine-models/new");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Namco");
  await page.getByLabel("Kategorie").selectOption("arcade");
  await page.getByLabel("Technik").selectOption("crt");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Namco)` });
  await page.getByLabel("Standort").fill("Hall 3");
  await page.getByLabel("Status").selectOption("not-on-display");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  return { museumNumber: (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0] };
}

/** The group of the form that holds that machine. */
const groupOf = (page: Page, museumNumber: string) => page.locator("details").filter({ hasText: museumNumber });

const header = (group: ReturnType<typeof groupOf>) => group.locator("summary");

async function opened(page: Page, museumNumber: string) {
  const group = groupOf(page, museumNumber);
  if (!(await group.evaluate((element) => (element as HTMLDetailsElement).open))) await header(group).click();
  return group;
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("ST-094: Choosing a whole group works only with JavaScript", async ({ page }) => {
    await logIn(page);
    const machine = await aMachine(page, "not-on-display");
    await page.goto("/team/maintenance-plan/new");
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);

    const group = groupOf(page, machine.museumNumber);
    await expect(header(group)).toContainText(/Flipper – 0 von \d+ ausgewählt/);
    await expect(group.getByRole("button", { name: "Alle auswählen" })).toHaveCount(0);
    await opened(page, machine.museumNumber);
    await page.getByRole("checkbox", { name: new RegExp(machine.museumNumber) }).check();
    await expect(page.getByRole("checkbox", { name: new RegExp(machine.museumNumber) })).toBeChecked();

    // The count says what was chosen when the page opened – without JavaScript it does not follow the tick.
    await expect(header(group)).toContainText(/Flipper – 0 von \d+ ausgewählt/);
    await expect(page.getByRole("button", { name: "Alle auswählen" })).toHaveCount(0);
  });

  test("ST-094: A rejected task keeps the chosen machines and opens their groups", async ({ page }) => {
    await logIn(page);
    const flipper = await aMachine(page, "not-on-display");
    const arcade = await anArcadeMachine(page);
    await page.goto("/team/maintenance-plan/new");
    await page.getByLabel("Name").fill(unique("Wax playfield"));
    await page.getByLabel("Intervall in Monaten").fill("12");
    await opened(page, flipper.museumNumber);
    await page.getByRole("checkbox", { name: new RegExp(flipper.museumNumber) }).check();
    // Both groups are closed when the page opens – the arcade group stays closed.
    await expect(groupOf(page, arcade.museumNumber)).not.toHaveAttribute("open", "");

    // The instruction is made of spaces only: it passes the browser's check, and the command rejects it.
    await page.getByLabel("Anleitung").fill("   ");
    await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();

    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte eine Anleitung angeben.");
    await expect(page.getByRole("checkbox", { name: new RegExp(flipper.museumNumber) })).toBeChecked();
    await expect(page.getByLabel("Name")).toHaveValue(/Wax playfield/);
    await expect(page.getByLabel("Intervall in Monaten")).toHaveValue("12");
    await expect(groupOf(page, flipper.museumNumber)).toHaveAttribute("open", "");
    await expect(groupOf(page, arcade.museumNumber)).not.toHaveAttribute("open", "");
    await expect(header(groupOf(page, arcade.museumNumber))).toContainText(/Arcade · CRT – 0 von \d+ ausgewählt/);
  });
});

test.describe("with JavaScript", () => {
  test("ST-094: Choosing a whole group works only with JavaScript", async ({ page }) => {
    await logIn(page);
    const machine = await aMachine(page, "not-on-display");
    await page.goto("/team/maintenance-plan/new");

    const group = groupOf(page, machine.museumNumber);
    await expect(header(group)).toContainText(/Flipper – 0 von \d+ ausgewählt/);
    await group.getByRole("button", { name: "Alle auswählen" }).click();

    // The whole group is chosen and the header follows, in the same count it opened with.
    const total = Number((await header(group).textContent())!.match(/(\d+) von (\d+)/)![2]);
    await expect(header(group)).toContainText(`Flipper – ${total} von ${total} ausgewählt`);
    // The group stays closed while it is chosen as a whole; opened, every machine in it is ticked.
    await opened(page, machine.museumNumber);
    await expect(group.getByRole("checkbox", { name: new RegExp(machine.museumNumber) })).toBeChecked();
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);

    // Ticking one more follows the count too.
    const other = await anArcadeMachine(page);
    await page.goto("/team/maintenance-plan/new");
    const arcade = await opened(page, other.museumNumber);
    await arcade.getByRole("checkbox", { name: new RegExp(other.museumNumber) }).check();
    await expect(header(arcade)).toContainText(/Arcade · CRT – 1 von \d+ ausgewählt/);
  });

  test("a task with chosen machines is added, and the plan counts them", async ({ page }) => {
    await logIn(page);
    const machine = await aMachine(page, "not-on-display");
    const name = unique("Clean glass (inside & out)");
    await page.goto("/team/maintenance-plan/new");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Anleitung").fill("Glass out, clean both sides.");
    await page.getByLabel("Intervall in Monaten").fill("1");
    const group = await opened(page, machine.museumNumber);
    await group.getByRole("checkbox", { name: new RegExp(machine.museumNumber) }).check();

    await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();

    const main = page.getByRole("main");
    await expect(main.getByRole("status")).toHaveText(`„${name}“ ist jetzt im Wartungsplan.`);
    await expect(main.getByRole("listitem").filter({ hasText: name })).toContainText("Gilt für 1 Gerät");
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  });
});

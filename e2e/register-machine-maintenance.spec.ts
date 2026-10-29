import type { Page } from "@playwright/test";
import { aHelper, expect, logIn, pageWidth, test, tickMachines, unique, untickMaintenanceTasks } from "./fixtures";

/**
 * Choosing a new machine's maintenance tasks on the registration form (ST-097, G27): with JavaScript, choosing a machine
 * model ticks the tasks that already apply to a machine of the same machine category and technology and says why; the
 * ticks the technician has not touched follow a change of the model. Without JavaScript, and after a rejection, nothing is
 * proposed. What is stored, the rejections and the proposals' rule are tested on the page's side
 * (`src/app/(team)/team/machines/new/register-with-tasks.integration.test.ts`). The machines of the set-up are Not on
 * display, so no task is due because of these tests. Registering with tasks changes the one maintenance plan, so this
 * file runs in the project of the specs that change it (`playwright.config.ts`). Needs the e2e technician each local run
 * creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** A machine model of this test's own – its title, as the registration's select names it with its manufacturer. */
async function aModel(page: Page, title: string, machineCategory: "pinball" | "arcade", technology: string) {
  const unique_ = unique(title);
  await page.goto("/team/machine-models/new");
  await page.getByLabel("Titel").fill(unique_);
  await page.getByLabel("Hersteller").fill("Bally");
  await page.getByLabel("Kategorie").selectOption(machineCategory);
  await page.getByLabel("Technik").selectOption(technology);
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: unique_, exact: true })).toBeVisible();
  return `${unique_} (Bally)`;
}

/** A machine of that model, Not on display and without maintenance tasks – its museum number. */
async function aMachineOf(page: Page, model: string) {
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: model });
  await untickMaintenanceTasks(page);
  await page.getByLabel("Standort").fill("Workshop");
  await page.getByLabel("Status").selectOption("not-on-display");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  return (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
}

/** A maintenance task of this test's own that applies to the given machines – its name. */
async function aTask(page: Page, name: string, museumNumbers: string[], intervalMonths = "12") {
  const unique_ = unique(name);
  await page.goto("/team/maintenance-plan/new");
  await page.getByLabel("Name").fill(unique_);
  await page.getByLabel("Anleitung").fill("How to do it.");
  await page.getByLabel("Intervall in Monaten").fill(intervalMonths);
  await tickMachines(page, ...museumNumbers.map((museumNumber) => ({ museumNumber })));
  await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(unique_);
  return unique_;
}

/** The fold of the choice (a native `<details>`, G27) that holds the task of that name – unique to this run. */
const groupOfTask = (page: Page, name: string) => page.locator("details").filter({ hasText: name });

/** A task's checkbox – also while its fold is closed, which hides it from the accessibility tree. */
const taskBox = (page: Page, name: string) =>
  page.locator("label").filter({ hasText: name }).locator('input[type="checkbox"]');

/** Ticks or unticks a task on the registration form, opening its fold first. */
async function setTask(page: Page, name: string, ticked: boolean) {
  const group = groupOfTask(page, name);
  if (!(await group.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await group.locator("summary > span").click();
  }
  await taskBox(page, name).setChecked(ticked);
}

/** „Gerät erfassen“, once the page has hydrated – „Alle auswählen“ shows only then. */
async function openRegistration(page: Page) {
  await page.goto("/team/machines/new");
  await expect(page.getByRole("button", { name: "Alle auswählen" }).first()).toBeAttached();
}

const proposalLine = (page: Page) => page.getByRole("main").getByText(/^Vorgeschlagen: /);

test("ST-097: Tasks of the same kind of machine are proposed and the line says why", async ({ page }) => {
  await logIn(page);
  const fireball = await aModel(page, "Fireball", "pinball", "em");
  const galaxian = await aModel(page, "Galaxian", "arcade", "crt");
  const lg005 = await aMachineOf(page, fireball);
  const arcade = await aMachineOf(page, galaxian);
  const proposed = [
    await aTask(page, "Clean & adjust score reels / stepper units", [lg005]),
    await aTask(page, "Wax playfield", [lg005], "6"),
    await aTask(page, "Clean glass (inside & out)", [lg005], "1"),
  ];
  const joysticks = await aTask(page, "Test joysticks, buttons, coin door", [arcade]);

  await openRegistration(page);
  await page.getByLabel("Modell").selectOption({ label: fireball });

  for (const name of proposed) await expect(taskBox(page, name)).toBeChecked();
  await expect(taskBox(page, joysticks)).not.toBeChecked();
  // Every task that applies to an EM pinball machine is proposed – in this run's database the three of LG-005 and
  // those of earlier tests of this file; the line counts them all.
  const ticked = await page.locator('input[name="maintenanceTaskId"]:checked').count();
  expect(ticked).toBeGreaterThanOrEqual(3);
  await expect(proposalLine(page)).toHaveText(
    `Vorgeschlagen: ${ticked} Wartungsaufgaben, die schon für Geräte mit Flipper · EM gelten.`,
  );
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-097: Untouched proposals follow a change of the machine model", async ({ page }) => {
  await logIn(page);
  const fireball = await aModel(page, "Fireball", "pinball", "em");
  const medievalMadness = await aModel(page, "Medieval Madness", "pinball", "dmd");
  const scoreReels = await aTask(page, "Clean & adjust score reels / stepper units", [
    await aMachineOf(page, fireball),
  ]);
  const cleanPlayfield = await aTask(page, "Clean playfield", [await aMachineOf(page, medievalMadness)]);
  const switchTest = await aTask(page, "Switch test (every switch)", []);

  await openRegistration(page);
  await page.getByLabel("Modell").selectOption({ label: fireball });
  await expect(taskBox(page, scoreReels)).toBeChecked();
  await setTask(page, switchTest, true);
  await page.getByLabel("Modell").selectOption({ label: medievalMadness });

  await expect(taskBox(page, scoreReels)).not.toBeChecked();
  await expect(taskBox(page, cleanPlayfield)).toBeChecked();
  await expect(taskBox(page, switchTest)).toBeChecked();
  await expect(proposalLine(page)).toHaveText(/die schon für Geräte mit Flipper · DMD (gilt|gelten)\.$/);
});

test("ST-097: A rejected registration keeps the ticks and proposes nothing again", async ({ page }) => {
  await logIn(page);
  const fireball = await aModel(page, "Fireball", "pinball", "em");
  const scoreReels = await aTask(page, "Clean & adjust score reels / stepper units", [
    await aMachineOf(page, fireball),
  ]);
  const cleanGlass = await aTask(page, "Clean glass (inside & out)", [], "1");
  const location = unique("Hall 2, row 3");

  await openRegistration(page);
  await page.getByLabel("Modell").selectOption({ label: fireball });
  await expect(taskBox(page, scoreReels)).toBeChecked();
  await setTask(page, scoreReels, false);
  await setTask(page, cleanGlass, true);
  await page.getByLabel("Museumsnummer").fill("42");
  await page.getByLabel("Standort").fill(location);
  await page.getByRole("button", { name: "Gerät erfassen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte die Museumsnummer als „LG-“ mit drei Ziffern angeben, zum Beispiel LG-042 – oder das Feld leer lassen.",
  );
  await expect(taskBox(page, cleanGlass)).toBeChecked();
  await expect(groupOfTask(page, cleanGlass)).toHaveAttribute("open", "");
  await expect(groupOfTask(page, cleanGlass).locator("summary")).toContainText("Jeden Monat");
  await expect(taskBox(page, scoreReels)).not.toBeChecked();
  await expect(proposalLine(page)).toHaveCount(0);
  // Nothing was registered – the overview has no machine at that location.
  await page.goto("/team/machines");
  await expect(page.getByRole("main")).not.toContainText(location);
});

test("ST-097: Helpers are still not offered registering", async ({ page }) => {
  await logIn(page);
  const helper = await aHelper(page);

  await logIn(page, helper);
  await page.getByRole("navigation").getByRole("link", { name: "Geräte" }).click();

  await expect(page.getByRole("heading", { name: "Geräte" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gerät erfassen" })).toHaveCount(0);
  // The registration page is not theirs either – its Server Action rejects a helper too (the page's integration test).
  await page.goto("/team/machines/new");
  await expect(page).toHaveURL(/\/team$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("ST-097: Without JavaScript nothing is proposed", async ({ page }) => {
    await logIn(page);
    const fireball = await aModel(page, "Fireball", "pinball", "em");
    const scoreReels = await aTask(page, "Clean & adjust score reels / stepper units", [
      await aMachineOf(page, fireball),
    ]);

    await page.goto("/team/machines/new");
    await page.getByLabel("Modell").selectOption({ label: fireball });

    await expect(page.locator('input[name="maintenanceTaskId"]:checked')).toHaveCount(0);
    await expect(proposalLine(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Alle auswählen" })).toHaveCount(0);
    // The technician ticks the task and registers the machine with it.
    await setTask(page, scoreReels, true);
    await page.getByLabel("Standort").fill("Workshop");
    await page.getByLabel("Status").selectOption("not-on-display");
    await page.getByRole("button", { name: "Gerät erfassen" }).click();
    const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
    await page.goto(`/team/machines/${museumNumber}/wartungsaufgaben-aendern`);
    await expect(taskBox(page, scoreReels)).toBeChecked();
  });
});

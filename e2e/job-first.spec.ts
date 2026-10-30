import type { Page } from "@playwright/test";
import { aMachine, expect, logIn, pageWidth, test, tickMachines, unique } from "./fixtures";

/**
 * Form pages name their job first and buttons say what they do (ST-091, G34, G14, G10b): „<job> · <thing>“ as the
 * heading of every form page, and no „Speichern“ or „Weiter“ on a button. Needs the e2e technician each local run
 * creates (ST-083).
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password, "needs the e2e technician account");
});

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

/**
 * A maintenance task added through the form – applying to machines that are Not on display, so it is never due and
 * the due maintenance list the other specs check stays empty. Returns its ID.
 */
async function aMaintenanceTask(page: Page, name: string, ...machines: { museumNumber: string }[]) {
  await page.goto("/team/maintenance-plan/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Anleitung").fill("Glass out, clean both sides.");
  await page.getByLabel("Intervall in Monaten").fill("1");
  if (machines.length) await tickMachines(page, ...machines);
  await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ ist jetzt im Wartungsplan.`);
  const change = page.getByRole("main").getByRole("listitem").filter({ hasText: name }).getByRole("link");
  return (await change.getAttribute("href"))!.split("/").pop()!;
}

test("ST-091: Form pages of a machine name the job first", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);

  for (const [address, title] of [
    ["status", `Status ändern · ${museumNumber}`],
    ["standort", `Standort ändern · ${museumNumber}`],
    ["datei-anhaengen", `Datei anhängen · ${museumNumber}`],
    ["foto-anhaengen", `Foto anhängen · ${museumNumber}`],
    ["angaben", `Angaben korrigieren · ${museumNumber}`],
    ["ausmustern", `Ausmustern · ${museumNumber}`],
  ]) {
    await page.goto(`/team/machines/${museumNumber}/${address}`);
    await expect(heading(page)).toHaveText(title);
  }
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-091: The change forms of a maintenance task and a machine model name the job first", async ({ page }) => {
  await logIn(page);
  const name = unique("Wax playfield");
  const maintenanceTaskId = await aMaintenanceTask(page, name);
  const { title } = await aMachine(page);

  await page.goto(`/team/maintenance-plan/${maintenanceTaskId}`);
  await expect(heading(page)).toHaveText(`Wartungsaufgabe ändern · ${name}`);

  await page.goto("/team/machine-models");
  await page.getByRole("link", { name: title, exact: true }).click();
  await page.getByRole("link", { name: "Modell korrigieren" }).click();
  await expect(heading(page)).toHaveText(`Modell korrigieren · ${title}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-091: Recording for several machines names the maintenance task", async ({ page }) => {
  await logIn(page);
  // Nothing may be due in the browser tests' database (see `due-maintenance.spec.ts`): the machines are Not on
  // display, and the page is opened at the address „Für mehrere Geräte erfassen“ has on a due task.
  const first = await aMachine(page, "not-on-display");
  const second = await aMachine(page, "not-on-display");
  const name = unique("Clean glass (inside & out)");
  const maintenanceTaskId = await aMaintenanceTask(page, name, first, second);

  await page.goto(`/team/maintenance/mehrere?task=${maintenanceTaskId}`);

  await expect(heading(page)).toHaveText(`Wartung erfassen · ${name}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-091: Buttons say what they do", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  const maintenanceTaskId = await aMaintenanceTask(page, unique("Wax playfield"));
  const main = page.getByRole("main");

  await page.goto("/team/password");
  await expect(main.getByRole("button")).toHaveText(["Passwort ändern"]);

  await page.goto(`/team/maintenance-plan/${maintenanceTaskId}`);
  await expect(main.getByRole("button", { name: "Wartungsaufgabe ändern" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Änderungen speichern" })).toHaveCount(0);

  await page.goto(`/team/machines/${museumNumber}/ausmustern`);
  await expect(main.getByRole("button")).toHaveText(["Gerät ausmustern"]);
  // It leads to the question; only „Endgültig ausmustern“ carries it out.
  await page.getByLabel("Grund").fill("Sold to a collector");
  await main.getByRole("button", { name: "Gerät ausmustern" }).click();
  await expect(main.getByRole("button", { name: "Endgültig ausmustern" })).toBeVisible();
});

test("ST-091: Removing a maintenance task is confirmed with „Endgültig entfernen“", async ({ page }) => {
  await logIn(page);
  const name = unique("Wax playfield");
  const maintenanceTaskId = await aMaintenanceTask(page, name);

  await page.goto(`/team/maintenance-plan/${maintenanceTaskId}`);
  await page.getByRole("button", { name: "Wartungsaufgabe entfernen" }).click();

  await expect(page.getByRole("main").getByRole("button")).toHaveText(["Endgültig entfernen", "Zurück"]);
  await page.getByRole("button", { name: "Endgültig entfernen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ ist nicht mehr im Wartungsplan.`);
});

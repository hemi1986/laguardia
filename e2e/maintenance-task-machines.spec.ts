import type { Page } from "@playwright/test";
import {
  aHelper,
  aMachine,
  expect,
  groupOf,
  logIn,
  openedGroup,
  pageWidth,
  test,
  tickMachines,
  unique,
} from "./fixtures";

/**
 * Changing the machines of a maintenance task on a phone (ST-095, G27, G33, G34): the task's page says how many machines
 * it applies to and leads to „Geräte ändern“, whose groups are closed with the machines of the task ticked; sending lands
 * on the maintenance plan with how many machines the task applies to now. The machines are Not on display, so no task is
 * due because of these tests (`due-maintenance.spec.ts`). The page's data and the rejections are tested at
 * `maintenance-plan/[maintenanceTaskId]/geraete-aendern/change-machines.integration.test.ts`. Needs the e2e technician
 * each local run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** A maintenance task added through the form, applying to these machines – the plan lists it. Returns its address. */
async function aMaintenanceTask(page: Page, name: string, ...machines: { museumNumber: string }[]) {
  await page.goto("/team/maintenance-plan/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Anleitung").fill("Wax the playfield.");
  await page.getByLabel("Intervall in Monaten").fill("12");
  await tickMachines(page, ...machines);
  await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ ist jetzt im Wartungsplan.`);
  const href = await page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ hasText: name })
    .getByRole("link", { name: `„${name}“ ändern` })
    .getAttribute("href");
  return href!;
}

test("ST-095: The task's page shows the count and leads to the form page", async ({ page }) => {
  await logIn(page);
  const [lg1, lg2, lg3] = [
    await aMachine(page, "not-on-display"),
    await aMachine(page, "not-on-display"),
    await aMachine(page, "not-on-display"),
  ];
  const name = unique("Wax playfield");
  const address = await aMaintenanceTask(page, name, lg1, lg2, lg3);

  await page.goto(address);

  // Under the heading, before the first field.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`„${name}“ ändern`);
  const main = page.getByRole("main");
  await expect(main.getByText("Gilt für 3 Geräte")).toBeVisible();
  const open = main.getByRole("link", { name: "Geräte ändern" });
  await expect(open).toBeVisible();
  const order = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("main p, main a, main input, main textarea"));
    return {
      count: items.findIndex((element) => element.textContent === "Gilt für 3 Geräte"),
      field: items.findIndex((element) => element.tagName === "INPUT" || element.tagName === "TEXTAREA"),
    };
  });
  expect(order.count).toBeGreaterThanOrEqual(0);
  expect(order.count).toBeLessThan(order.field);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await open.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Geräte ändern · ${name}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await page.getByRole("link", { name: "Zurück zur Wartungsaufgabe" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`„${name}“ ändern`);
});

test("ST-095: A technician adds a machine to a maintenance task", async ({ page }) => {
  await logIn(page);
  const [lg1, lg2, lg3] = [
    await aMachine(page, "not-on-display"),
    await aMachine(page, "not-on-display"),
    await aMachine(page, "not-on-display"),
  ];
  const name = unique("Clean glass (inside & out)");
  const address = await aMaintenanceTask(page, name, lg1, lg2);

  await page.goto(`${address}/geraete-aendern`);
  // The machines the task applies to are ticked; the groups are closed when the page opens.
  await expect(groupOf(page, lg1.museumNumber)).not.toHaveAttribute("open", "");
  await openedGroup(page, lg1.museumNumber);
  await expect(page.getByRole("checkbox", { name: new RegExp(lg1.museumNumber) })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: new RegExp(lg2.museumNumber) })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: new RegExp(lg3.museumNumber) })).not.toBeChecked();
  await page.getByRole("checkbox", { name: new RegExp(lg3.museumNumber) }).check();
  await page.getByRole("button", { name: "Geräte ändern" }).click();

  // On the maintenance plan, which confirms and shows the count.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wartungsplan");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ gilt jetzt für 3 Geräte.`);
  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: name })).toContainText(
    "Gilt für 3 Geräte",
  );

  // Sent again without a change: the same landing, no rejection (G33).
  await page.goto(`${address}/geraete-aendern`);
  await page.getByRole("button", { name: "Geräte ändern" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ gilt jetzt für 3 Geräte.`);
});

test("helpers are not offered „Geräte ändern“ and are sent away from its address", async ({ page }) => {
  await logIn(page);
  const machine = await aMachine(page, "not-on-display");
  const address = await aMaintenanceTask(page, unique("Wax playfield"), machine);
  const helper = await aHelper(page);
  await logIn(page, helper);

  await page.goto(address);
  await expect(page).toHaveURL(/\/team$/);
  await page.goto(`${address}/geraete-aendern`);
  await expect(page).toHaveURL(/\/team$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the machines are changed by ticking natively, and the group stays a native fold", async ({ page }) => {
    await logIn(page);
    const [lg1, lg2] = [await aMachine(page, "not-on-display"), await aMachine(page, "not-on-display")];
    const name = unique("Oil the gum machine");
    const address = await aMaintenanceTask(page, name, lg1);

    await page.goto(`${address}/geraete-aendern`);
    await expect(page.getByRole("button", { name: "Alle auswählen" })).toHaveCount(0);
    await openedGroup(page, lg1.museumNumber);
    await page.getByRole("checkbox", { name: new RegExp(lg1.museumNumber) }).uncheck();
    await page.getByRole("checkbox", { name: new RegExp(lg2.museumNumber) }).check();
    await page.getByRole("button", { name: "Geräte ändern" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ gilt jetzt für 1 Gerät.`);
  });
});

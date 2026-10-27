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
 * Choosing the machines of a new maintenance task on a phone (ST-094, G27): „Geräte der Wartungsaufgabe“ in groups
 * that fold – native, so they open without JavaScript – with „Alle auswählen“ only when JavaScript runs. A rejection
 * keeps the choice and opens the groups with a choice in them. The machines are Not on display, so no task is due
 * because of these tests (`due-maintenance.spec.ts`). The groups, their order and the empty case are tested on the
 * page's data (`maintenance-plan/new/machine-choice.integration.test.ts`). Needs the e2e technician each local run
 * creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 *
 * Changing the machines of a task (ST-095, G27, G33, G34) is in the second half of this file: the task's page says how
 * many machines it applies to and leads to „Geräte ändern“, whose groups are closed with the machines of the task ticked;
 * sending lands on the maintenance plan with how many machines it applies to now. Its page data and rejections are tested
 * at `maintenance-plan/[maintenanceTaskId]/geraete-aendern/change-machines.integration.test.ts`. **One file, on purpose:**
 * the confirmations of the maintenance plan ask for the latest change of the one plan (G3), so specs that change it must
 * not run at the same time as the same technician – the tests of a file run one after the other.
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

const header = (group: ReturnType<typeof groupOf>) => group.locator("summary");
const opened = openedGroup;

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the machines are ticked one by one, and the count says what was chosen when the page opened", async ({
    page,
  }) => {
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

  test("a rejected task keeps the chosen machines and opens their groups in the browser", async ({ page }) => {
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
  test("ST-094: Choosing a whole group works only with JavaScript", async ({ page, browser, baseURL }) => {
    await logIn(page);
    const machine = await aMachine(page, "not-on-display");

    // Given JavaScript is switched off: „Alle auswählen“ is not shown, the header keeps the count of the page's opening.
    const withoutScripts = await browser.newContext({
      javaScriptEnabled: false,
      baseURL,
      viewport: { width: 360, height: 800 },
    });
    const plain = await withoutScripts.newPage();
    await logIn(plain);
    await plain.goto("/team/maintenance-plan/new");
    await expect(groupOf(plain, machine.museumNumber).locator("summary")).toContainText(
      /Flipper – 0 von \d+ ausgewählt/,
    );
    await expect(plain.getByRole("button", { name: "Alle auswählen" })).toHaveCount(0);
    await (
      await openedGroup(plain, machine.museumNumber)
    )
      .getByRole("checkbox", { name: new RegExp(machine.museumNumber) })
      .check();
    await expect(groupOf(plain, machine.museumNumber).locator("summary")).toContainText(
      /Flipper – 0 von \d+ ausgewählt/,
    );
    await withoutScripts.close();

    // But with JavaScript „Alle auswählen“ ticks the whole group.
    await page.goto("/team/maintenance-plan/new");
    const group = groupOf(page, machine.museumNumber);
    await expect(header(group)).toContainText(/Flipper – 0 von \d+ ausgewählt/);
    await group.getByRole("button", { name: "Alle auswählen" }).click();

    // The whole group is chosen and the header follows, in the same count it opened with.
    const total = Number((await header(group).textContent())!.match(/(\d+) von (\d+)/)![2]);
    await expect(header(group)).toContainText(`Flipper – ${total} von ${total} ausgewählt`);
    // The button in the header does not fold the group: it stays closed while it is chosen as a whole.
    await expect(group).not.toHaveAttribute("open", "");
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

/** A maintenance task added through the form, applying to these machines – the plan lists it. Returns its address. */
async function aMaintenanceTask(page: Page, name: string, ...machines: { museumNumber: string }[]) {
  await page.goto("/team/maintenance-plan/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Anleitung").fill("Wax the playfield.");
  await page.getByLabel("Intervall in Monaten").fill("12");
  await tickMachines(page, ...machines);
  await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();
  // The plan lists it. (Not its confirmation: that asks for the latest change of the one plan, and other browser tests
  // change it at the same time as the same technician.)
  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: name })).toBeVisible();
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

test("a technician adds a machine on the form page and lands on the plan with the count", async ({ page }) => {
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
  const helper = await aHelper(page);
  await logIn(page, helper);

  // Whether the maintenance task exists does not matter: a helper is sent away before anything is read.
  const address = "/team/maintenance-plan/7a1e0f40-0000-4000-8000-000000000041";
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

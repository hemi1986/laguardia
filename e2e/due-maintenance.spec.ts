import { aMachine, expect, logIn, pageWidth, test, tickMachines, unique } from "./fixtures";

/**
 * The due maintenance list on a phone (ST-043): „Wartung“ in the navigation's line (G19 row 5), the filter for
 * helpers as a plain GET form that works without JavaScript. A maintenance task is due at once on every machine it
 * applies to (ST-094), so the browser tests choose only machines that are Not on display for their tasks: nothing is
 * ever due here – the list with its tasks, counts and machines is tested on the page's data and its rendering (`src/app/(team)/team/maintenance/due-maintenance.integration.test.ts`). Needs the e2e technician each
 * local run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("„Wartung“ leads to the due maintenance list, which says in words that nothing is due", async ({ page }) => {
  await logIn(page);

  await page.getByRole("navigation").getByRole("link", { name: "Wartung", exact: true }).click();

  await expect(page).toHaveURL(/\/team\/maintenance$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fällige Wartung");
  await expect(page.getByRole("main")).toContainText("Gerade ist keine Wartung fällig.");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the filter for helpers is sent and stays chosen", async ({ page }) => {
    await logIn(page);
    await page.goto("/team/maintenance");

    await page.getByLabel("Nur für Helfer:innen geeignet").check();
    await page.getByRole("button", { name: "Filtern" }).click();

    await expect(page).toHaveURL(/\/team\/maintenance\?helpers=1$/);
    await expect(page.getByLabel("Nur für Helfer:innen geeignet")).toBeChecked();
    await expect(page.getByRole("main")).toContainText("Gerade ist keine Wartung für Helfer:innen fällig.");
  });
});

/**
 * „Für mehrere Geräte erfassen“ (ST-045) without JavaScript: native checkboxes and fields, so a phone without scripts
 * records too. Nothing is due here (see above), so the machines are ticked under „Weitere Geräte“, in their folds – the page is opened
 * at its address, as the list offers it only on a due task.
 */
test.describe("recording for several machines without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the ticked machines are recorded, and the list confirms them", async ({ page }) => {
    await logIn(page);
    const first = await aMachine(page, "not-on-display");
    const second = await aMachine(page, "not-on-display");
    const name = unique("Clean glass (inside & out)");
    await page.goto("/team/maintenance-plan/new");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Anleitung").fill("Glass out, clean both sides.");
    await page.getByLabel("Intervall in Monaten").fill("1");
    await tickMachines(page, first, second);
    await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();
    const change = page.getByRole("main").getByRole("listitem").filter({ hasText: name }).getByRole("link");
    const maintenanceTaskId = (await change.getAttribute("href"))!.split("/").pop()!;

    await page.goto(`/team/maintenance/mehrere?task=${maintenanceTaskId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Wartung erfassen · ${name}`);
    await page.getByLabel("Ergebnis").selectOption({ label: "Erledigt" });
    await page.getByRole("button", { name: "Wartung eintragen" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte mindestens ein Gerät auswählen.");

    // The rejection kept the outcome.
    await expect(page.getByLabel("Ergebnis")).toHaveValue("done");
    // Under „Weitere Geräte“ they sit in closed native folds (ST-098), opened without JavaScript.
    await tickMachines(page, first, second);
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
    await page.getByRole("button", { name: "Wartung eintragen" }).click();

    await expect(page).toHaveURL(/\/team\/maintenance\?/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ an 2 Geräten eingetragen.`);
  });
});

/**
 * „Wartung erfassen“ opened from the machine record (ST-047) without JavaScript: the form leads back to the machine
 * record, which confirms the record and lists it in section 5 „Wartung“. Nothing is due here (see above), so the form
 * is opened at the address the machine record's „Wartung erfassen“ has.
 */
test.describe("recording from the machine record without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the form leads back to the machine record, which confirms and shows the maintenance record", async ({
    page,
  }) => {
    await logIn(page);
    const machine = await aMachine(page, "not-on-display");
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
    await expect(page.getByRole("link", { name: "Zurück zum Gerät" })).toHaveAttribute(
      "href",
      `/team/machines/${encodeURIComponent(machine.museumNumber)}`,
    );
    await page.getByLabel("Ergebnis").selectOption({ label: "Erledigt" });
    await page.getByLabel("Notiz (optional)").fill("Playfield wiped from the machine record");
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
    await page.getByRole("button", { name: "Wartung eintragen" }).click();

    await expect(page).toHaveURL(new RegExp(`/team/machines/${encodeURIComponent(machine.museumNumber)}\\?`));
    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      `Wartung an ${machine.museumNumber} eingetragen.`,
    );
    await expect(page.getByRole("main")).toContainText("Playfield wiped from the machine record");
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  });
});

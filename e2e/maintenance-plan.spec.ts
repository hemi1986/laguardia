import type { Page } from "@playwright/test";
import { aHelper, expect, logIn, openMore, pageWidth, test, unique } from "./fixtures";

/**
 * The maintenance plan on a phone (ST-040): „Mehr“ → „Wartungsplan“ → „Wartungsaufgabe hinzufügen“ → the form page
 * → back on the plan with the confirmation and the new maintenance task, its restriction in words and when it is first
 * due. Native controls only, so the same works without JavaScript; helpers find no way there. „Ändern“ on a task leads
 * to its change form, which also removes it after asking once (ST-041, G10b). Needs the e2e technician
 * each local run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** Fills in the form „Wartungsaufgabe hinzufügen“ the way a technician does. */
async function fillIn(page: Page, name: string, { category, technology }: { category: string; technology?: string }) {
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Anleitung").fill("Glass out, clean both sides.");
  await page.getByLabel("Intervall in Monaten").fill("1");
  await page.getByLabel("Für Helfer:innen geeignet").check();
  await page.getByLabel("Nur für Kategorie").selectOption({ label: category });
  if (technology) await page.getByLabel("Und nur für Technik").selectOption({ label: technology });
  await page.getByLabel("Start").fill("2026-10-01");
}

/** A maintenance task added through the form – back on the maintenance plan, which lists it. */
async function aMaintenanceTask(page: Page, name: string) {
  await page.goto("/team/maintenance-plan/new");
  await fillIn(page, name, { category: "Flipper" });
  await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ ist jetzt im Wartungsplan.`);
}

/** The entry of the maintenance task of that name on the maintenance plan. */
const entryOf = (page: Page, name: string) => page.getByRole("main").getByRole("listitem").filter({ hasText: name });

test("a technician adds a maintenance task to the maintenance plan", async ({ page }) => {
  await logIn(page);
  const name = unique("Clean glass (inside & out)");

  await openMore(page);
  await page.getByRole("navigation").getByRole("link", { name: "Wartungsplan" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wartungsplan");
  await page.getByRole("main").getByRole("link", { name: "Wartungsaufgabe hinzufügen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wartungsaufgabe hinzufügen");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await fillIn(page, name, { category: "Flipper" });
  await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();

  const main = page.getByRole("main");
  await expect(main.getByRole("status")).toHaveText(`„${name}“ ist jetzt im Wartungsplan.`);
  const entry = main.getByRole("listitem").filter({ hasText: name });
  await expect(entry).toContainText("Jeden Monat · Nur Flipper · Für Helfer:innen geeignet");
  await expect(entry).toContainText("Start 01.10.2026 · erstmals fällig 01.11.2026");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("helpers find no maintenance plan, and are sent away from its address", async ({ page }) => {
  await logIn(page);
  const helper = await aHelper(page);
  await logIn(page, helper);

  await openMore(page);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Wartungsplan" })).toHaveCount(0);
  await page.goto("/team/maintenance-plan/new");
  await expect(page).toHaveURL(/\/team$/);
  await page.goto("/team/maintenance-plan/7a1e0f40-0000-4000-8000-000000000041");
  await expect(page).toHaveURL(/\/team$/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a rejected maintenance task keeps what was typed, and is added once the restriction fits", async ({ page }) => {
    await logIn(page);
    const name = unique("Clean & adjust score reels");
    await page.goto("/team/maintenance-plan/new");

    await fillIn(page, name, { category: "Arcade", technology: "EM (Flipper)" });
    await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();

    await expect(page.getByRole("main")).toContainText("Diese Technik passt nicht zu dieser Kategorie.");
    await expect(page.getByLabel("Name")).toHaveValue(name);
    await expect(page.getByLabel("Start")).toHaveValue("2026-10-01");
    await expect(page.getByLabel("Und nur für Technik")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Nur für Kategorie").selectOption({ label: "Flipper" });
    await page.getByRole("button", { name: "Wartungsaufgabe hinzufügen" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ ist jetzt im Wartungsplan.`);
    await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: name })).toContainText(
      "Nur Flipper · EM",
    );
  });

  test("ST-041: Removing asks once", async ({ page }) => {
    await logIn(page);
    const name = unique("Wax playfield");
    await aMaintenanceTask(page, name);

    await entryOf(page, name)
      .getByRole("link", { name: `„${name}“ ändern` })
      .click();
    await page.getByLabel("Intervall in Monaten").fill("6");
    await page.getByRole("button", { name: "Wartungsaufgabe entfernen" }).click();

    const question = `„${name}“ aus dem Wartungsplan entfernen? Sie wird nie wieder fällig; die Wartungseinträge bleiben.`;
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(question);
    await expect(page.getByLabel("Anleitung")).toHaveCount(0);
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
    await page.getByRole("button", { name: "Zurück" }).click();

    // Nothing removed, and the form keeps what was typed.
    await expect(page.getByLabel("Intervall in Monaten")).toHaveValue("6");
    await page.goto("/team/maintenance-plan");
    await expect(entryOf(page, name)).toHaveCount(1);

    await entryOf(page, name)
      .getByRole("link", { name: `„${name}“ ändern` })
      .click();
    await page.getByRole("button", { name: "Wartungsaufgabe entfernen" }).click();
    await page.getByRole("button", { name: "Entfernen" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ ist nicht mehr im Wartungsplan.`);
    await expect(entryOf(page, name)).toHaveCount(0);
  });
});

test("a technician changes a maintenance task and is back on the maintenance plan", async ({ page }) => {
  await logIn(page);
  const name = unique("Clean playfield");
  await aMaintenanceTask(page, name);

  await entryOf(page, name)
    .getByRole("link", { name: `„${name}“ ändern` })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`„${name}“ ändern`);
  await expect(page.getByLabel("Anleitung")).toHaveValue("Glass out, clean both sides.");
  await expect(page.getByLabel("Für Helfer:innen geeignet")).toBeChecked();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.getByLabel("Intervall in Monaten").fill("2");
  await page.getByLabel("Für Helfer:innen geeignet").uncheck();
  await page.getByLabel("Und nur für Technik").selectOption({ label: "EM (Flipper)" });
  await page.getByRole("button", { name: "Änderungen speichern" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${name}“ geändert.`);
  await expect(entryOf(page, name)).toContainText("Alle 2 Monate · Nur Flipper · EM");
  await expect(entryOf(page, name)).not.toContainText("Für Helfer:innen geeignet");
});

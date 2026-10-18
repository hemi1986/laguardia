import type { Page } from "@playwright/test";
import { expect, logIn, openMore, pageWidth, test, unique } from "./fixtures";

/**
 * The machine model page on a phone (ST-006) and the Server Action runner in the browser (ST-073): a rejected
 * creation shows the catalogue text of its error code and keeps what was typed. Needs a technician account:
 * locally the e2e technician each local run creates (ST-083) (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD); the preview
 * database has none before ST-068 seeds it, so this runs locally only – like the account tests of ST-005.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("a technician creates a machine model on a 360 px phone", async ({ page }) => {
  await logIn(page);
  const title = `Medieval Madness ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

  await openMore(page);
  await page.getByRole("link", { name: "Modelle" }).click();
  await expect(page).toHaveURL(/\/team\/machine-models$/);
  await page.getByRole("link", { name: "Neues Modell" }).click();

  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Baujahr").fill("1997");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByLabel("Technik").selectOption("dmd");
  await page.getByRole("button", { name: "Modell anlegen" }).click();

  const model = page.getByRole("article").filter({ hasText: title });
  await expect(model.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(model).toContainText("Williams · 1997 · Flipper · DMD");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("a technology that does not fit the machine category is rejected and the input is kept", async ({ page }) => {
  await logIn(page);
  await page.goto("/team/machine-models/new");

  await page.getByLabel("Titel").fill("Galaxian");
  await page.getByLabel("Hersteller").fill("Namco");
  await page.getByLabel("Kategorie").selectOption("arcade");
  await page.getByLabel("Technik").selectOption("dmd");
  await page.getByRole("button", { name: "Modell anlegen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Diese Technik passt nicht zu dieser Kategorie.");
  await expect(page.getByLabel("Titel")).toHaveValue("Galaxian");
  await expect(page.getByLabel("Hersteller")).toHaveValue("Namco");
  await expect(page.getByLabel("Technik")).toHaveAttribute("aria-invalid", "true");
  await page.goto("/team/machine-models");
  await expect(page.getByRole("article").filter({ hasText: "Galaxian" })).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a technician creates a machine model with the technology they chose", async ({ page }) => {
    await logIn(page);
    const title = `Xenon ${Date.now().toString(36)}`;

    await page.goto("/team/machine-models/new");
    await page.getByLabel("Titel").fill(title);
    await page.getByLabel("Hersteller").fill("Bally");
    await page.getByLabel("Kategorie").selectOption("pinball");
    await page.getByLabel("Technik").selectOption("solid-state");
    await page.getByRole("button", { name: "Modell anlegen" }).click();

    // The chosen technology really arrived at the server – the selects are native controls (ST-076).
    await expect(page.getByRole("article").filter({ hasText: title })).toContainText("Bally · Flipper · Solid-State");
  });
});

/** A machine model created on its own page by the logged-in technician; returns its title. */
async function aMachineModel(page: Page, title = unique("Medieval Madness"), year = "1979") {
  await page.goto("/team/machine-models/new");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Baujahr").fill(year);
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByLabel("Technik").selectOption("dmd");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Modell „${title}“ angelegt.`);
  return title;
}

/** A machine of that model, registered by the logged-in technician. */
async function aMachineOf(page: Page, title: string, year: string) {
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams, ${year})` });
  await page.getByLabel("Standort").fill("Hall 2");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toBeVisible();
}

/** From the list of machine models to the model's own page, the way a technician gets there. */
async function openMachineModel(page: Page, title: string) {
  await page.goto("/team/machine-models");
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
}

test("ST-036: Creating a machine model happens on its own page", async ({ page }) => {
  await logIn(page);
  await page.goto("/team/machine-models");
  const title = unique("Medieval Madness");

  await page.getByRole("link", { name: "Neues Modell" }).click();
  await expect(page).toHaveURL(/\/team\/machine-models\/new$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neues Modell");
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();

  await expect(page).toHaveURL(/\/team\/machine-models\?created=/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Modell „${title}“ angelegt.`);
  await expect(page.getByRole("article").filter({ hasText: title })).toBeVisible();
});

test("ST-036: A machine model has its own page", async ({ page }) => {
  await logIn(page);
  const title = await aMachineModel(page, unique("Medieval Madness"), "1997");
  for (let machine = 0; machine < 3; machine++) await aMachineOf(page, title, "1997");

  await openMachineModel(page, title);

  const details = page.getByRole("main").locator("dl");
  for (const [term, value] of [
    ["Titel", title],
    ["Hersteller", "Williams"],
    ["Baujahr", "1997"],
    ["Kategorie", "Flipper"],
    ["Technik", "DMD"],
  ]) {
    await expect(details.locator("div").filter({ has: page.locator("dt", { hasText: term }) })).toContainText(value);
  }
  await expect(page.getByRole("link", { name: "Modell korrigieren" })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-036: The correction form says how many machines it affects", async ({ page }) => {
  await logIn(page);
  const title = await aMachineModel(page);
  for (let machine = 0; machine < 3; machine++) await aMachineOf(page, title, "1979");

  await openMachineModel(page, title);
  await page.getByRole("link", { name: "Modell korrigieren" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Modell „${title}“ korrigieren`);
  await expect(page.getByRole("main")).toContainText("Gilt für alle 3 Geräte dieses Modells.");
  await expect(page.getByLabel("Baujahr")).toHaveValue("1979");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("a correction lands on the machine model's page, and a rejected one keeps what was typed", async ({ page }) => {
  await logIn(page);
  const title = await aMachineModel(page);
  await openMachineModel(page, title);
  await page.getByRole("link", { name: "Modell korrigieren" }).click();
  await expect(page.getByRole("main")).toContainText("Noch kein Gerät hat dieses Modell.");

  await page.getByLabel("Baujahr").fill("19x7");
  await page.getByRole("button", { name: "Modell korrigieren" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte ein Baujahr mit vier Ziffern angeben, zum Beispiel 1997.",
  );
  await expect(page.getByLabel("Baujahr")).toHaveValue("19x7");
  await expect(page.getByLabel("Baujahr")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Baujahr").fill("1997");
  await page.getByRole("button", { name: "Modell korrigieren" }).click();
  await expect(page).toHaveURL(/\/team\/machine-models\/[^/]+\?corrected=1$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Modell „${title}“ korrigiert.`);
  await expect(page.getByRole("main").locator("dl")).toContainText("1997");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("correcting without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a correction with a new technology is saved, and an unchanged one is rejected", async ({ page }) => {
    await logIn(page);
    const title = await aMachineModel(page);
    await openMachineModel(page, title);
    await page.getByRole("link", { name: "Modell korrigieren" }).click();

    await page.getByRole("button", { name: "Modell korrigieren" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Am Modell hat sich nichts geändert. Bitte etwas ändern.",
    );
    await page.getByLabel("Technik").selectOption("lcd");
    await page.getByRole("button", { name: "Modell korrigieren" }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText(`Modell „${title}“ korrigiert.`);
    await expect(page.getByRole("main").locator("dl")).toContainText("LCD");
  });
});

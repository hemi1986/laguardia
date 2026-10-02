import { expect, openMore, test } from "./fixtures";

/**
 * The machine model page on a phone (ST-006) and the Server Action runner in the browser (ST-073): a rejected
 * creation shows the catalogue text of its error code and keeps what was typed. Needs a technician account:
 * locally the one from `npm run setup:first-technician` (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD); the preview
 * database has none before ST-068 seeds it, so this runs locally only – like the account tests of ST-005.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

async function logIn(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("a technician creates a machine model on a 360 px phone", async ({ page }) => {
  await logIn(page);
  const title = `Medieval Madness ${Date.now().toString(36)}`;

  await openMore(page);
  await page.getByRole("link", { name: "Modelle" }).click();
  await expect(page).toHaveURL(/\/team\/machine-models$/);

  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Baujahr").fill("1997");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByLabel("Technik").selectOption("dmd");
  await page.getByRole("button", { name: "Modell anlegen" }).click();

  const model = page.getByRole("article").filter({ hasText: title });
  await expect(model.getByRole("heading", { name: title })).toBeVisible();
  await expect(model).toContainText("Williams · 1997 · Flipper · DMD");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("a technology that does not fit the machine category is rejected and the input is kept", async ({ page }) => {
  await logIn(page);
  await page.goto("/team/machine-models");

  await page.getByLabel("Titel").fill("Galaxian");
  await page.getByLabel("Hersteller").fill("Namco");
  await page.getByLabel("Kategorie").selectOption("arcade");
  await page.getByLabel("Technik").selectOption("dmd");
  await page.getByRole("button", { name: "Modell anlegen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Diese Technik passt nicht zu dieser Kategorie.");
  await expect(page.getByLabel("Titel")).toHaveValue("Galaxian");
  await expect(page.getByLabel("Hersteller")).toHaveValue("Namco");
  await expect(page.getByRole("article").filter({ hasText: "Galaxian" })).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a technician creates a machine model with the technology they chose", async ({ page }) => {
    await logIn(page);
    const title = `Xenon ${Date.now().toString(36)}`;

    await page.goto("/team/machine-models");
    await page.getByLabel("Titel").fill(title);
    await page.getByLabel("Hersteller").fill("Bally");
    await page.getByLabel("Kategorie").selectOption("pinball");
    await page.getByLabel("Technik").selectOption("solid-state");
    await page.getByRole("button", { name: "Modell anlegen" }).click();

    // The chosen technology really arrived at the server – the selects are native controls (ST-076).
    await expect(page.getByRole("article").filter({ hasText: title })).toContainText("Bally · Flipper · Solid-State");
  });
});

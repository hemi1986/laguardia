import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The machine overview on a phone (ST-008). Visitors are sent to the login – that needs no account and runs on the
 * preview too. The search needs a technician account: locally the one from `npm run setup:first-technician`
 * (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD); the preview database has none before ST-068.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A registered machine, so the overview is a list to search in and not its empty state. */
async function aRegisteredMachine(page: Page) {
  const title = `Medieval Madness ${Date.now().toString(36)}`;
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 1, row 1");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  await expect(page).toHaveURL(/\/team\/machines\?registered=/);
}

test("ST-008: Visitors cannot open the machine overview", async ({ page }) => {
  await page.goto("/team/machines");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Benutzername")).toBeVisible();
});

test("ST-008: No machine matches the search", async ({ page }) => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  await logIn(page);
  await aRegisteredMachine(page);
  const search = `jukebox ${Date.now().toString(36)}`;

  await page.getByRole("navigation", { name: "Navigation" }).getByRole("link", { name: "Geräte" }).click();
  await page.getByLabel("Suche").fill(search);
  await page.getByRole("button", { name: "Suchen" }).click();

  await expect(page.getByRole("main")).toContainText(`Kein Gerät passt zu „${search}“.`);
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.getByRole("link", { name: "Suche zurücksetzen" }).click();
  await expect(page).toHaveURL(/\/team\/machines$/);
  await expect(page.getByLabel("Suche")).toHaveValue("");
  await expect(page.getByRole("article").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360); // the full list
});

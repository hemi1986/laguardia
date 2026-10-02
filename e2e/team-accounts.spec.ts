import { expect, openMore, test } from "./fixtures";

/**
 * Managing accounts on a phone (ST-005). Needs a technician account: locally the one from
 * `npm run setup:first-technician` (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD); the preview database has none
 * before ST-068 seeds it, so this runs locally only – like the login test of ST-004.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(async ({ page }) => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
});

test("a technician creates, changes and deactivates an account on a 360 px phone", async ({ page }) => {
  const newUsername = `e2e_${Date.now().toString(36)}`;

  await openMore(page);
  await page.getByRole("link", { name: "Teammitglieder" }).click();
  await expect(page).toHaveURL(/\/team\/members$/);

  await page.getByLabel("Name", { exact: true }).fill(`E2E ${newUsername}`);
  await page.getByLabel("Benutzername").fill(newUsername);
  await page.getByLabel("Anfangspasswort").fill("e2e-secret-10");
  await page.getByRole("button", { name: "Konto anlegen" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  const account = page.getByRole("article").filter({ hasText: newUsername });
  await expect(account.getByRole("heading", { name: `E2E ${newUsername}` })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await account.getByLabel(`Neues Passwort – E2E ${newUsername}`).fill("e2e-second-10");
  await account.getByRole("button", { name: "Passwort zurücksetzen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Passwort neu gesetzt.");

  await page
    .getByRole("article")
    .filter({ hasText: newUsername })
    .getByRole("button", { name: "Deaktivieren" })
    .click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto deaktiviert.");
  await expect(page.getByRole("article").filter({ hasText: newUsername })).toContainText("deaktiviert");
});

test("a helper cannot reach the technician pages", async ({ page }) => {
  const helper = `e2e_helper_${Date.now().toString(36)}`;

  // The technician creates the helper account this test then logs in with.
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${helper}`);
  await page.getByLabel("Benutzername").fill(helper);
  await page.getByLabel("Anfangspasswort").fill("helper-secret-10");
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");

  await page.goto("/team");
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  await page.getByLabel("Benutzername").fill(helper);
  await page.getByLabel("Passwort").fill("helper-secret-10");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);

  // Opened, so the missing links are really missing – not just hidden in the closed "Mehr" (ST-008).
  await openMore(page);
  await expect(page.getByRole("link", { name: "Passwort ändern" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Teammitglieder" })).toHaveCount(0);
  await page.goto("/team/members");
  await expect(page).toHaveURL(/\/team$/);

  // The machine model page is technician-only too (ST-006).
  await expect(page.getByRole("link", { name: "Modelle" })).toHaveCount(0);
  await page.goto("/team/machine-models");
  await expect(page).toHaveURL(/\/team$/);
});

test("a team member changes their own password and a wrong current password is rejected", async ({ page }) => {
  await openMore(page);
  await page.getByRole("link", { name: "Passwort ändern" }).click();
  await expect(page).toHaveURL(/\/team\/password$/);

  await page.getByLabel("Aktuelles Passwort").fill("definitely-wrong");
  await page.getByLabel("Neues Passwort").fill("does-not-matter-10");
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Das aktuelle Passwort stimmt nicht.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

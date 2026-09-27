import { expect, test } from "./fixtures";

test("ST-004: Team pages require login", async ({ page }) => {
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();

  // A public page – stand-in for the visitor machine page (ST-010) – opens without login.
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/login/);
});

// Logging in needs an account: locally the one from `npm run setup:first-technician` (E2E_TEAM_USERNAME /
// E2E_TEAM_PASSWORD); the preview database has none before ST-068 seeds it, so this runs locally only.
test("a team member logs in and out on a 360 px phone", async ({ page }) => {
  const username = process.env.E2E_TEAM_USERNAME;
  const password = process.env.E2E_TEAM_PASSWORD;
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local team member account");

  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByText(/Angemeldet als/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login$/);
});

import { expect, test } from "./fixtures";

/**
 * The team shell (ST-076): one navigation for every team page, the landmarks the other tests rely on, and the
 * 360 px rules. Needs a technician account: locally the one from `npm run setup:first-technician`
 * (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD) – the preview database has none before ST-068.
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

test.beforeEach(async () => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("every team page carries the same navigation, once per destination, with logout", async ({ page }) => {
  await logIn(page);

  for (const path of ["/team", "/team/members", "/team/password"]) {
    await page.goto(path);
    await expect(page.getByRole("navigation")).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    // Playwright's strict mode fails these if a page offered a destination twice.
    await expect(page.getByRole("link", { name: "Teammitglieder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Passwort ändern" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
  }

  // The navigation is walkable by keyboard, in the order it is written.
  await page.getByRole("link", { name: "Start" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Teammitglieder" })).toBeFocused();
});

test("login and the team start page stay within 360 px, with the rejection inside main", async ({ page }) => {
  await page.goto("/login?error=login-failed");

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/Anmeldung fehlgeschlagen/);
  await expect(page.getByLabel("Benutzername")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await logIn(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("the login form is reachable by keyboard and shows where the focus is", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Benutzername").focus();
  await expect(page.getByLabel("Benutzername")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Passwort")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Anmelden" })).toBeFocused();

  const focusRing = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { outline: style.outlineStyle, shadow: style.boxShadow };
  });
  expect(focusRing.outline !== "none" || focusRing.shadow !== "none").toBe(true);
});

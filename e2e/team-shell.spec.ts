import { expect, logIn, openMore, test } from "./fixtures";

/**
 * The team shell (ST-076): one navigation for every team page, the landmarks the other tests rely on, and the
 * 360 px rules. Needs a technician account: locally the e2e technician each local run creates (ST-083)
 * (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD) – the preview database has none before ST-068.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(async () => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("every team page carries the same navigation, once per destination, with logout", async ({ page }) => {
  await logIn(page);

  for (const path of [
    "/team",
    "/team/machines",
    "/team/maintenance-plan",
    "/team/machine-models",
    "/team/members",
    "/team/password",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("navigation", { name: "Navigation" })).toHaveCount(1);
    await expect(page.getByRole("main")).toHaveCount(1);
    // Playwright's strict mode fails these if a page offered a destination twice.
    await expect(page.getByRole("link", { name: "Übersicht" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Geräte", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sichtung" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Defekte", exact: true })).toBeVisible();
    await openMore(page);
    await expect(page.getByRole("link", { name: "Wartungsplan" })).toBeVisible(); // since ST-040, G19 row 6
    await expect(page.getByRole("link", { name: "Modelle" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Teammitglieder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Passwort ändern" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  }

  // The navigation is walkable by keyboard, in the order decided in ST-008: the daily destinations, then "Mehr".
  await page.goto("/team");
  await page.getByRole("link", { name: "Übersicht" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Geräte", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Sichtung" })).toBeFocused(); // since ST-017, G19 row 3
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Defekte", exact: true })).toBeFocused(); // since ST-021, G19 row 4
  await page.keyboard.press("Tab");
  await expect(page.getByRole("navigation").locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Wartungsplan" })).toBeFocused(); // since ST-040, G19 row 6
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Modelle" })).toBeFocused();
});

test("'Mehr' closes when a destination in it is chosen, and on Escape", async ({ page }) => {
  await logIn(page);
  const more = page.getByRole("navigation").locator("details");

  await openMore(page);
  await page.getByRole("link", { name: "Modelle" }).click();
  await expect(page).toHaveURL(/\/team\/machine-models$/);
  await expect(more).not.toHaveAttribute("open");

  await openMore(page);
  await page.keyboard.press("Escape");
  await expect(more).not.toHaveAttribute("open");
});

test("login and the team start page stay within 360 px, with the rejection inside main", async ({ page }) => {
  // A rejected login – for a username nobody has, so no failed attempt counts against the e2e technician. (Until the
  // backlog grooming of 2026-10-11 the rejection came from the address; now only a real rejected login shows it.)
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(`nobody_${Date.now().toString(36)}`);
  await page.getByLabel("Passwort").fill("not-the-password");
  await page.getByRole("button", { name: "Anmelden" }).click();

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

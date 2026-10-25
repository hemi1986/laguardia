import { expect, openMore, test } from "./fixtures";

/**
 * One's own password on a phone (ST-005) – the team members' accounts are `team-members.spec.ts` (ST-081). Needs a technician account: locally the e2e technician each local run creates
 * (ST-083) (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD); the preview database has none
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

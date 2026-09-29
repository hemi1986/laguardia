import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The account pages rebuilt from the shared UI components (ST-077): the accessibility contract of ST-005 and the
 * 360 px rules hold for the new markup. Needs a technician account: locally the one from
 * `npm run setup:first-technician` (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD) – the preview database has none
 * before ST-068.
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

function unique(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function createAccount(page: Page, name: string, accountUsername: string) {
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Benutzername").fill(accountUsername);
  await page.getByLabel("Anfangspasswort").fill("e2e-secret-10");
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
}

async function pageWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("every label on the account pages resolves to exactly one field", async ({ page }) => {
  await page.goto("/team/members");
  for (const label of ["Benutzername", "Anfangspasswort", "Rolle"]) {
    await expect(page.getByLabel(label)).toHaveCount(1);
  }
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Anfangspasswort")).toHaveAccessibleDescription("Mindestens 10 Zeichen.");

  await page.goto("/team/password");
  for (const label of ["Aktuelles Passwort", "Neues Passwort"]) {
    await expect(page.getByLabel(label)).toHaveCount(1);
  }
});

test("each account is one article with its own heading and controls, told apart by name", async ({ page }) => {
  const first = unique("e2e_a");
  const second = unique("e2e_b");
  await createAccount(page, `E2E ${first}`, first);
  await createAccount(page, `E2E ${second}`, second);

  for (const accountUsername of [first, second]) {
    const account = page.getByRole("article").filter({ hasText: accountUsername });
    await expect(account).toHaveCount(1);
    await expect(account.getByRole("heading", { name: `E2E ${accountUsername}` })).toBeVisible();
    await expect(account.getByRole("button", { name: "Zu Techniker:in machen" })).toBeVisible();
    await expect(account.getByRole("button", { name: "Passwort zurücksetzen" })).toBeVisible();
    await expect(account.getByRole("button", { name: "Deaktivieren" })).toBeVisible();
    await expect(page.getByLabel(`Neues Passwort – E2E ${accountUsername}`)).toHaveCount(1);
    await expect(account.getByLabel(`Neues Passwort – E2E ${accountUsername}`)).toHaveCount(1);
  }
});

test("a deactivated account stays recognisable and offers no controls", async ({ page }) => {
  const accountUsername = unique("e2e_d");
  await createAccount(page, `E2E ${accountUsername}`, accountUsername);

  await page
    .getByRole("article")
    .filter({ hasText: accountUsername })
    .getByRole("button", { name: "Deaktivieren" })
    .click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto deaktiviert.");

  const account = page.getByRole("article").filter({ hasText: accountUsername });
  await expect(account).toContainText("deaktiviert");
  await expect(account.getByRole("button")).toHaveCount(0);
  await expect(account.getByRole("textbox")).toHaveCount(0);
});

test("a 60-character name without spaces keeps the account list within 360 px", async ({ page }) => {
  const accountUsername = unique("e2e_l");
  const longName = `L${accountUsername}`.padEnd(60, "x");
  expect(longName).toHaveLength(60);
  await createAccount(page, longName, accountUsername);

  await expect(page.getByRole("article").filter({ hasText: accountUsername })).toHaveCount(1);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

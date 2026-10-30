import type { Page } from "@playwright/test";
import { expect, pageWidth, test, uniqueId as unique } from "./fixtures";

/**
 * The account pages rebuilt from the shared UI components (ST-077), on the pages of ST-081 and ST-088: the accessibility contract of ST-005 and the
 * 360 px rules hold for the new markup. Needs a technician account: locally the e2e technician each local run creates
 * (ST-083) (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD) – the preview database has none
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

async function createAccount(page: Page, name: string, accountUsername: string) {
  await page.goto("/team/members/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Benutzername").fill(accountUsername);
  await page.getByLabel("Anfangspasswort").fill("e2e-secret-10");
  await page.getByRole("button", { name: "Teammitglied anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${name} ist angelegt.`);
}

/** The team member's own page, opened from the list (ST-081). */
async function openAccount(page: Page, name: string) {
  await page.goto("/team/members");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("every label on the account pages resolves to exactly one field", async ({ page }) => {
  await page.goto("/team/members/new");
  for (const label of ["Benutzername", "Anfangspasswort", "Rolle"]) {
    await expect(page.getByLabel(label)).toHaveCount(1);
  }
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Anfangspasswort")).toHaveAccessibleDescription("Mindestens 10 Zeichen.");

  const accountUsername = unique("e2e_f");
  await createAccount(page, `E2E ${accountUsername}`, accountUsername);
  await openAccount(page, `E2E ${accountUsername}`);
  await page.getByRole("link", { name: "Konto bearbeiten" }).click();
  for (const label of ["Benutzername", "Rolle", "Neues Passwort"]) {
    await expect(page.getByLabel(label)).toHaveCount(1);
  }
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Neues Passwort")).toHaveAccessibleDescription("Mindestens 10 Zeichen.");

  await page.goto("/team/password");
  for (const label of ["Aktuelles Passwort", "Neues Passwort"]) {
    await expect(page.getByLabel(label)).toHaveCount(1);
  }
});

test("each team member is one list entry with a link of their name, told apart by their username", async ({ page }) => {
  const first = unique("e2e_a");
  const second = unique("e2e_b");
  await createAccount(page, `E2E ${first}`, first);
  await createAccount(page, `E2E ${second}`, second);

  for (const accountUsername of [first, second]) {
    const entry = page.getByRole("main").getByRole("listitem").filter({ hasText: accountUsername });
    await expect(entry).toHaveCount(1);
    await expect(entry.getByRole("link", { name: `E2E ${accountUsername}`, exact: true })).toBeVisible();
    await expect(entry.getByRole("button")).toHaveCount(0);
  }
});

test("a deactivated account's page offers one control only", async ({ page }) => {
  const accountUsername = unique("e2e_d");
  await createAccount(page, `E2E ${accountUsername}`, accountUsername);
  await openAccount(page, `E2E ${accountUsername}`);
  await page.getByRole("button", { name: "Konto deaktivieren" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von E2E ${accountUsername} deaktiviert.`);

  const main = page.getByRole("main");
  await expect(main).toContainText("Konto: deaktiviert");
  await expect(main.getByRole("button")).toHaveCount(1);
  await expect(main.locator("input:not([type=hidden]), select")).toHaveCount(0);
});

test("a 60-character name without spaces keeps the list and the team member's page within 360 px", async ({
  page,
}) => {
  const accountUsername = unique("e2e_l");
  const longName = `L${accountUsername}`.padEnd(60, "x");
  expect(longName).toHaveLength(60);
  await createAccount(page, longName, accountUsername);

  await expect(page.getByRole("main").getByRole("listitem").filter({ hasText: accountUsername })).toHaveCount(1);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await openAccount(page, longName);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

// „Passwort ändern“ on the house pattern (G8, backlog grooming 2026-10-11). The current password is the right one, so
// the rejection is about the new one and no failed attempt is counted against the e2e technician.
test("a new password that is too short is said above the submit button and marks its field", async ({ page }) => {
  await page.goto("/team/password");
  await page.getByLabel("Aktuelles Passwort").fill(password!);
  await page.getByLabel("Neues Passwort").fill("short");
  await page.getByRole("button", { name: "Passwort ändern" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Das Passwort braucht mindestens 10 Zeichen.");
  await expect(page.getByLabel("Neues Passwort")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Aktuelles Passwort")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Neues Passwort")).toHaveValue("");
  const alert = await page.getByRole("main").getByRole("alert").boundingBox();
  const submit = await page.getByRole("button", { name: "Passwort ändern" }).boundingBox();
  const field = await page.getByLabel("Neues Passwort").boundingBox();
  expect(alert!.y).toBeGreaterThan(field!.y);
  expect(alert!.y).toBeLessThan(submit!.y);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

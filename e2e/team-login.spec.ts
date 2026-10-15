import type { Page } from "@playwright/test";
import { expect, openMore, test } from "./fixtures";

test("ST-004: Team pages require login", async ({ page }) => {
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();

  // A public page – stand-in for the visitor machine page (ST-010) – opens without login.
  await page.goto("/");
  await expect(page).not.toHaveURL(/\/login/);
});

// Logging in needs an account: locally the e2e technician each local run creates (ST-083) (E2E_TEAM_USERNAME /
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
  // The e2e technician lands on the technician dashboard, which replaced the start page placeholder (ST-048).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Übersicht");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login$/);
});

/** A username nobody has – a wrong login for it never locks the e2e technician out (ST-004: five failed attempts). */
const nobody = () => `nobody_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function rejectedLogin(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username);
  await page.getByLabel("Passwort").fill("not-the-password");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.",
  );
}

// The login on the house pattern (G8, backlog grooming 2026-10-11): needs the local database, like the test above.
test("a rejected login keeps the username, empties the password and marks both fields; a reload forgets it", async ({
  page,
}) => {
  test.skip(!!process.env.BASE_URL, "runs against the local browser-test database");
  const username = nobody();

  await rejectedLogin(page, username);

  await expect(page.getByLabel("Benutzername")).toHaveValue(username);
  await expect(page.getByLabel("Passwort")).toHaveValue("");
  await expect(page.getByLabel("Benutzername")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Passwort")).toHaveAttribute("aria-invalid", "true");
  // The reason stands immediately above the submit button.
  const alert = await page.getByRole("main").getByRole("alert").boundingBox();
  const submit = await page.getByRole("button", { name: "Anmelden" }).boundingBox();
  const password = await page.getByLabel("Passwort").boundingBox();
  expect(alert!.y).toBeGreaterThan(password!.y);
  expect(alert!.y).toBeLessThan(submit!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.goto("/login");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Benutzername")).toHaveValue("");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a rejected login keeps the username and empties the password", async ({ page }) => {
    test.skip(!!process.env.BASE_URL, "runs against the local browser-test database");
    const username = nobody();

    await rejectedLogin(page, username);

    await expect(page.getByLabel("Benutzername")).toHaveValue(username);
    await expect(page.getByLabel("Passwort")).toHaveValue("");
  });
});

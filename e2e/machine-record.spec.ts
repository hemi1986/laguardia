import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The machine record on a phone (ST-009), opened from the machine overview. Needs a technician account: locally the
 * e2e technician each local run creates (ST-083, E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD); the preview database has none
 * before ST-068.
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

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** A machine model and a machine registered through the pages – returns the title and the assigned museum number. */
async function aRegisteredMachine(page: Page, location = "Hall 2, row 3") {
  const title = `Medieval Madness ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Baujahr").fill("1997");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByLabel("Technik").selectOption("dmd");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams, 1997)` });
  await page.getByLabel("Seriennummer").fill("MM-12345");
  await page.getByLabel("Standort").fill(location);
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const confirmation = page.getByRole("main").getByRole("status");
  const museumNumber = (await confirmation.textContent())!.match(/LG-\d{3}/)![0];
  return { title, museumNumber };
}

test("ST-009: Team member opens a machine record", async ({ page }) => {
  await logIn(page);
  const { title, museumNumber } = await aRegisteredMachine(page);

  await page.getByLabel("Suche").fill(title);
  await page.getByRole("button", { name: "Suchen" }).click();
  await page.getByRole("link", { name: `${museumNumber} · ${title}` }).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${museumNumber} · ${title}`);
  const details = page.getByRole("main").locator("dl");
  for (const [term, value] of [
    ["Seriennummer", "MM-12345"],
    ["Modell", title],
    ["Hersteller", "Williams"],
    ["Baujahr", "1997"],
    ["Kategorie", "Flipper"],
    ["Technik", "DMD"],
    ["Standort", "Hall 2, row 3"],
    ["Status", "Spielbereit"],
  ]) {
    await expect(details.locator("div").filter({ has: page.locator("dt", { hasText: term }) })).toContainText(value);
  }
  await expect(page.getByRole("heading", { name: "Status-Historie" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("a long word without spaces in the location keeps the machine record within 360 px", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aRegisteredMachine(page, `Werkstatt${"x".repeat(60)}`);

  await page.goto(`/team/machines/${museumNumber}`);

  await expect(page.getByRole("main")).toContainText("Werkstatt");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

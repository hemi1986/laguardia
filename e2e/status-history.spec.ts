import { aMachine, correctToAFreeNumber, expect, logIn, pageWidth, test } from "./fixtures";

/**
 * The status history's own page on a phone (ST-093). What it lists, the latest five on the machine record and the
 * year grouping are checked at the page data function (`status-history.integration.test.ts`); here the address: a
 * reserved museum number leads to the current one, and only team members get in.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test("ST-093: A reserved museum number leads to the current one", async ({ page }) => {
  // Needs the e2e technician each local run creates (ST-083); the preview database has none before ST-068.
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  await logIn(page);
  const { museumNumber: old } = await aMachine(page);
  const corrected = await correctToAFreeNumber(page, old);

  await page.goto(`/team/machines/${old}/status-historie`);

  await expect(page).toHaveURL(new RegExp(`/team/machines/${corrected}/status-historie$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Status-Historie · ${corrected}`);
  await expect(page.getByRole("main")).toContainText("Erfasst als Spielbereit");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await page.getByRole("link", { name: "Zurück zum Gerät" }).click();
  await expect(page).toHaveURL(new RegExp(`/team/machines/${corrected}$`));
});

test("ST-093: Visitors do not reach the status history page", async ({ page }) => {
  await page.goto("/team/machines/LG-042/status-historie");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});

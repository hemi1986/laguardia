import { expect, logIn, pageWidth, test } from "./fixtures";

/**
 * The due maintenance list on a phone (ST-043): „Wartung“ in the navigation's line (G19 row 5), the filter for
 * helpers as a plain GET form that works without JavaScript. Every machine a browser test registers is registered
 * today, so nothing is ever due here – the list with its tasks, counts and machines is tested on the page's data and
 * its rendering (`src/app/(team)/team/maintenance/due-maintenance.integration.test.ts`). Needs the e2e technician each
 * local run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("„Wartung“ leads to the due maintenance list, which says in words that nothing is due", async ({ page }) => {
  await logIn(page);

  await page.getByRole("navigation").getByRole("link", { name: "Wartung", exact: true }).click();

  await expect(page).toHaveURL(/\/team\/maintenance$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fällige Wartung");
  await expect(page.getByRole("main")).toContainText("Gerade ist keine Wartung fällig.");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the filter for helpers is sent and stays chosen", async ({ page }) => {
    await logIn(page);
    await page.goto("/team/maintenance");

    await page.getByLabel("Nur für Helfer:innen geeignet").check();
    await page.getByRole("button", { name: "Filtern" }).click();

    await expect(page).toHaveURL(/\/team\/maintenance\?helpers=1$/);
    await expect(page.getByLabel("Nur für Helfer:innen geeignet")).toBeChecked();
    await expect(page.getByRole("main")).toContainText("Gerade ist keine Wartung für Helfer:innen fällig.");
  });
});

import { expect, logIn, openMore, test } from "./fixtures";

/**
 * The file overview „Dateien“ (ST-117) on a phone: reached through „Mehr“, filtered with a plain form (also without
 * JavaScript), and closed to someone not logged in. The paging and the filters' rules are proven against the database in
 * `file-overview.integration.test.ts`; here the browser shows the page works at 360 px.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test("ST-117: Someone not logged in does not reach the overview", async ({ page }) => {
  await page.goto("/team/dateien");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Dateien" })).toHaveCount(0);
});

test.describe("with a team account", () => {
  test.beforeEach(() => {
    test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  });

  test("a team member opens „Dateien“ under „Mehr“ and filters it, at 360 px", async ({ page }) => {
    await logIn(page);
    await openMore(page);
    await page.getByRole("link", { name: "Dateien" }).click();

    await expect(page).toHaveURL(/\/team\/dateien$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dateien" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    if ((await page.getByRole("combobox", { name: "Dateikategorie" }).count()) === 0) return; // no file yet (G7)

    await page.getByLabel("Dateikategorie").selectOption("photo");
    await page.getByRole("button", { name: "Filtern" }).click();

    await expect(page).toHaveURL(/\/team\/dateien\?fileCategory=photo$/);
    await expect(page.getByLabel("Dateikategorie")).toHaveValue("photo");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test.beforeEach(() => {
    test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  });

  test("the filters are a plain form whose choice stays in the address", async ({ page }) => {
    await logIn(page);
    await page.goto("/team/dateien?fileCategory=photo&page=3");

    await expect(page.getByRole("heading", { level: 1, name: "Dateien" })).toBeVisible();
    if ((await page.getByRole("combobox", { name: "Dateikategorie" }).count()) === 0) return; // no file yet (G7)
    await expect(page.getByLabel("Dateikategorie")).toHaveValue("photo");
    await page.getByLabel("Dateikategorie").selectOption("manual");
    await page.getByRole("button", { name: "Filtern" }).click();

    // Sending the filters starts at page 1: the page is not carried along.
    await expect(page).toHaveURL(/\/team\/dateien\?fileCategory=manual$/);
  });
});

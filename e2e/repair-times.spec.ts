import { aHelper, expect, logIn, openMore, pageWidth, test } from "./fixtures";

/**
 * The repair times on a phone (ST-051): „Mehr“ → „Reparaturzeiten“, right after „Wartungsplan“, with the last 30
 * days preselected – technicians only; helpers find no way there and are sent away from its address. Needs the e2e
 * technician each local run creates (ST-083), so this runs locally only. What the times say is tested at the page's
 * data function, against a database of its own.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("ST-051: Technicians reach the repair times from the navigation", async ({ page }) => {
  await logIn(page);

  await openMore(page);
  const destinations = await page.getByRole("navigation").getByRole("listitem").allInnerTexts();
  const maintenancePlan = destinations.indexOf("Wartungsplan");
  expect(maintenancePlan).toBeGreaterThanOrEqual(0);
  expect(destinations[maintenancePlan + 1]).toBe("Reparaturzeiten");

  await page.getByRole("navigation").getByRole("link", { name: "Reparaturzeiten" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reparaturzeiten");
  await expect(page.getByRole("link", { name: "Letzte 30 Tage" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Letzte 90 Tage" })).not.toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Letzte 90 Tage" }).click();
  await expect(page.getByRole("link", { name: "Letzte 90 Tage" })).toHaveAttribute("aria-current", "page");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-051: Helpers cannot open the repair times", async ({ page }) => {
  await logIn(page);
  const helper = await aHelper(page);
  await logIn(page, helper);

  await openMore(page);
  await expect(page.getByRole("navigation").getByRole("link", { name: "Reparaturzeiten" })).toHaveCount(0);
  await page.goto("/team/repair-times");
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("Reparaturzeiten");
});

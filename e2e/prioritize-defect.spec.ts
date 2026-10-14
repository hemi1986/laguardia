import { anOpenDefect, expect, logIn, openDefect, pageWidth, test } from "./fixtures";

/**
 * Changing a defect's priority on a phone (ST-027, G22): the defect's page → „Verwalten“ → „Priorität ändern“ → the
 * form page → the confirmation and the new priority on the page, and the defect among the high-priority defects of the
 * open defects list. Needs the e2e technician each local run creates (ST-083); the preview database has none before
 * ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("a technician raises a defect's priority from its page", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main).toContainText("Priorität: normal");
  // The managing is behind one closed fold (G22).
  await expect(main.getByRole("link", { name: "Priorität ändern" })).toBeHidden();

  await main.getByText("Verwalten", { exact: true }).click();
  await main.getByRole("link", { name: "Priorität ändern" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Priorität ändern · ${museumNumber}`);
  await expect(main.getByRole("heading", { level: 2, name: title })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // Only the priorities it does not have yet are offered (G11).
  await expect(main.getByLabel("Neue Priorität").getByRole("option")).toHaveText(["Bitte wählen", "hoch", "niedrig"]);
  await main.getByLabel("Neue Priorität").selectOption({ label: "hoch" });
  await main.getByRole("button", { name: "Priorität ändern" }).click();

  await expect(main.getByRole("status")).toHaveText(`„${title}“ hat jetzt die Priorität hoch.`);
  await expect(main).toContainText("Priorität: hoch");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  // The open defects list shows it among the high-priority defects.
  await page.goto(`/team/defects?machine=${museumNumber}&priority=high`);
  await expect(main.getByRole("listitem")).toHaveCount(1);
  await expect(main.getByRole("listitem")).toContainText(title);
  await page.goto(`/team/defects?machine=${museumNumber}&priority=normal`);
  await expect(main.getByRole("listitem")).toHaveCount(0);
});

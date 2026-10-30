import { anOpenDefect, expect, logIn, openDefect, pageWidth, test } from "./fixtures";

/**
 * The repair history on a phone (ST-033): the QR address leads a team member to the machine record, which shows the
 * machine status, the open defects and the most recent repairs without further navigation; „Ganze Reparaturhistorie“
 * → a year → the defect. No timing here – the 2 seconds are measured in `machine-record-load.integration.test.ts`.
 * Needs the e2e technician each local run creates (ST-083); the preview database has none before ST-068, so this runs
 * locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;
const NOTE = "Lock replaced";

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("from the QR address to the repair history and back to the defect", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  const main = page.getByRole("main");

  // Open, it is in the machine record's open defects – not yet in its repair history.
  await page.goto(`/m/${museumNumber}`);
  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}$`));
  await expect(main).toContainText("Spielbereit");
  await expect(main.getByRole("link", { name: title })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await openDefect(page, museumNumber, title);
  await main.getByRole("link", { name: "Beheben", exact: true }).click();
  await page.getByLabel("Abschlussnotiz").fill(NOTE);
  await page.getByRole("button", { name: "Als behoben eintragen" }).click();
  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ behoben.`);

  await page.goto(`/m/${museumNumber}`);
  await expect(main).toContainText("Keine offenen Defekte.");
  await expect(main).toContainText(NOTE);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await main.getByRole("link", { name: "Ganze Reparaturhistorie (1)" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Reparaturhistorie · ${museumNumber}`);
  await main.getByRole("link", { name: /· 1 Eintrag$/ }).click();
  await expect(main).toContainText(NOTE);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await main.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});

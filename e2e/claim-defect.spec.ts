import {
  aHelper,
  anOpenDefect,
  expect,
  logIn,
  openDefect,
  openDefectsEntry,
  pageWidth,
  TECHNICIAN,
  test,
} from "./fixtures";

/**
 * Claiming a defect on a phone (ST-025): open defects list → the defect's page → „Übernehmen“ (or „Von … übernehmen“) →
 * the confirmation, the claimant on the page and in the list, and the filter „Nur von mir übernommene“. Needs the e2e
 * technician each local run creates (ST-083, named „E2E Technician“); the preview database has none before ST-068, so
 * this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("ST-025: Team member claims an unclaimed defect", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  await expect(await openDefectsEntry(page, museumNumber)).not.toContainText("bernommen");
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main).not.toContainText("bernommen von");

  await main.getByRole("button", { name: "Übernehmen", exact: true }).click();

  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ übernommen.`);
  await expect(main).toContainText("Von dir übernommen");
  // One's own claim is not offered again.
  await expect(main.getByRole("button", { name: /bernehmen/ })).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // The open defects list shows the claimant – to themselves, and by name to everyone else.
  await expect(await openDefectsEntry(page, museumNumber)).toContainText("Von dir übernommen");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await logIn(page, await aHelper(page));
  await expect(await openDefectsEntry(page, museumNumber)).toContainText(`Übernommen von ${TECHNICIAN}`);
});

test("a helper takes a defect over from its claimant and finds it with the filter for their own claims", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  await openDefect(page, museumNumber, title);
  await page.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toBeVisible();
  await logIn(page, await aHelper(page));
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main).toContainText(`Übernommen von ${TECHNICIAN}`);

  // No question first: a claim is only a signal (ST-025, decision 2a).
  await main.getByRole("button", { name: `Von ${TECHNICIAN} übernehmen` }).click();

  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ übernommen. Vorher: ${TECHNICIAN}.`);
  await expect(main).toContainText("Von dir übernommen");
  await expect(main).not.toContainText(`Übernommen von ${TECHNICIAN}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.goto("/team/defects");
  await page.getByLabel("Nur von mir übernommene").check();
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(/mine=1/);
  await expect(page.getByLabel("Nur von mir übernommene")).toBeChecked();
  const entries = main.getByRole("listitem");
  await expect(entries).toHaveCount(1);
  await expect(entries).toContainText(title);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("a helper is not offered a defect that is not suitable for helpers, and one without a claim says so in the filter", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await logIn(page, await aHelper(page));

  await openDefect(page, museumNumber, title);

  await expect(page.getByRole("main")).toContainText("Nicht für Helfer:innen geeignet");
  await expect(page.getByRole("main").getByRole("button", { name: /bernehmen/ })).toHaveCount(0);
  await page.goto("/team/defects?mine=1");
  await expect(page.getByRole("main")).toContainText("Du hast keinen offenen Defekt übernommen.");
});

test("a claim made meanwhile is answered with a conflict, not a silent takeover – then the page offers taking over", async ({
  page,
  browser,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  const helper = await aHelper(page);
  await logIn(page);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Übernehmen", exact: true })).toBeVisible();

  // Meanwhile on a second phone: the helper claims the same defect.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await context.newPage();
  await logIn(other, helper);
  await openDefect(other, museumNumber, title);
  await other.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(other.getByRole("main").getByRole("status")).toHaveText(`Du hast „${title}“ übernommen.`);
  await context.close();

  await main.getByRole("button", { name: "Übernehmen", exact: true }).click();

  await expect(main.getByRole("alert")).toHaveText(
    "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
  );
  await expect(main.getByRole("status")).toHaveCount(0);
  // The page shows the defect as it is now: claimed by the helper, who can be taken over from – knowingly.
  await expect(main).toContainText(`Übernommen von E2E ${helper.username}`);
  await main.getByRole("button", { name: `Von E2E ${helper.username} übernehmen` }).click();
  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ übernommen. Vorher: E2E ${helper.username}.`);
  // The rejection of the first try is gone with it.
  await expect(main.getByRole("alert")).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a defect is claimed", async ({ page }) => {
    await logIn(page);
    const { museumNumber, title } = await anOpenDefect(page);
    await openDefect(page, museumNumber, title);

    await page.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`Du hast „${title}“ übernommen.`);
    await expect(page.getByRole("main")).toContainText("Von dir übernommen");
  });
});

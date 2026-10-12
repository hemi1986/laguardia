import {
  aHelper,
  allowPreview,
  anOpenDefect,
  expect,
  logIn,
  openDefect,
  openDefectsEntry,
  pageWidth,
  test,
} from "./fixtures";

/**
 * Assigning a defect and releasing claims on a phone (ST-026, G22): the defect's page → „Verwalten“ → „Zuweisen“ → the
 * form page → the confirmation and the claimant on the page; the helper's „Abgeben“ where „Übernehmen“ stood; the
 * technician's „Übernahme von … aufheben“ behind „Verwalten“. Needs the e2e technician each local run creates (ST-083);
 * the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("a technician assigns a defect to a helper, who releases the claim again", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  const helper = await aHelper(page);
  const helperName = `E2E ${helper.username}`;
  await logIn(page);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  // The managing is behind one closed fold (G22).
  await expect(main.getByRole("link", { name: "Zuweisen" })).toBeHidden();

  await main.getByText("Verwalten", { exact: true }).click();
  await main.getByRole("link", { name: "Zuweisen" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Defekt zuweisen · ${museumNumber}`);
  await expect(main.getByRole("heading", { level: 2, name: title })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // Nobody chosen: the browser asks for a choice, nothing is sent.
  await main.getByRole("button", { name: "Zuweisen" }).click();
  await expect(page).toHaveURL(/\/zuweisen$/);
  await main.getByLabel("Zuweisen an").selectOption({ label: `${helperName} (Helfer:in)` });
  await main.getByRole("button", { name: "Zuweisen" }).click();

  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ ${helperName} zugewiesen.`);
  await expect(main).toContainText(`Übernommen von ${helperName} · Von dir zugewiesen`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expect(await openDefectsEntry(page, museumNumber)).toContainText(`Übernommen von ${helperName}`);

  // The helper finds it as their own claim, and releases it where „Übernehmen“ stood.
  await logIn(page, helper);
  await openDefect(page, museumNumber, title);
  await expect(main).toContainText("Von dir übernommen · Zugewiesen von E2E Technician");
  await expect(main.getByText("Verwalten", { exact: true })).toHaveCount(0);
  await expect(main.getByRole("button", { name: /bernehmen/ })).toHaveCount(0);

  await main.getByRole("button", { name: "Abgeben" }).click();

  await expect(main.getByRole("status")).toHaveText(`„${title}“ ist wieder frei.`);
  await expect(main).not.toContainText("bernommen");
  await expect(main.getByRole("button", { name: "Übernehmen", exact: true })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expect(await openDefectsEntry(page, museumNumber)).not.toContainText("bernommen");
});

test("a helper cannot release someone else's claim; a technician releases it behind „Verwalten“", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  const claimant = await aHelper(page);
  await logIn(page);
  const other = await aHelper(page);
  await logIn(page, claimant);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(main.getByRole("status")).toBeVisible();

  // Another helper may take it over, but is offered no release.
  await logIn(page, other);
  await openDefect(page, museumNumber, title);
  await expect(main.getByRole("button", { name: `Von E2E ${claimant.username} übernehmen` })).toBeVisible();
  await expect(main.getByRole("button", { name: /Abgeben|aufheben/ })).toHaveCount(0);
  await expect(main.getByText("Verwalten", { exact: true })).toHaveCount(0);

  await logIn(page);
  await openDefect(page, museumNumber, title);
  await main.getByText("Verwalten", { exact: true }).click();
  await main.getByRole("button", { name: `Übernahme von E2E ${claimant.username} aufheben` }).click();

  await expect(main.getByRole("status")).toHaveText(`„${title}“ ist wieder frei.`);
  await expect(main).not.toContainText("Übernommen von");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the fold opens, the defect is assigned and the claim released", async ({ page, browser, baseURL }) => {
    // The helper to assign to is created on a phone with JavaScript: only the pages of this story are under test.
    const context = await browser.newContext({ javaScriptEnabled: true, viewport: { width: 360, height: 800 } });
    const scripted = await context.newPage();
    await allowPreview(scripted, baseURL);
    await logIn(scripted);
    const helper = await aHelper(scripted);
    await context.close();
    await logIn(page);
    const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
    await openDefect(page, museumNumber, title);
    const main = page.getByRole("main");

    await main.getByText("Verwalten", { exact: true }).click();
    await main.getByRole("link", { name: "Zuweisen" }).click();
    await main.getByLabel("Zuweisen an").selectOption({ label: `E2E ${helper.username} (Helfer:in)` });
    await main.getByRole("button", { name: "Zuweisen" }).click();
    await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ E2E ${helper.username} zugewiesen.`);

    await main.getByText("Verwalten", { exact: true }).click();
    await main.getByRole("button", { name: `Übernahme von E2E ${helper.username} aufheben` }).click();
    await expect(main.getByRole("status")).toHaveText(`„${title}“ ist wieder frei.`);
  });
});

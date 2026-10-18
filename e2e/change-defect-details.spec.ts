import { aHelper, anOpenDefect, expect, logIn, openDefect, pageWidth, test, unique } from "./fixtures";

/**
 * Changing a defect's title or suitable-for-helpers mark on a phone (ST-031, G22): the defect's page → „Verwalten“ →
 * „Titel und Eignung ändern“ → the form page → the confirmation on the defect's page. Removing the mark of a defect a
 * helper has claimed releases the claim, and the form says so first. Needs the e2e technician each local run creates
 * (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("a technician changes a defect's title and removes the mark, releasing a helper's claim", async ({
  page,
  browser,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  const helper = await aHelper(page);

  // On the helper's phone: the helper claims the defect.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await context.newPage();
  await logIn(other, helper);
  await openDefect(other, museumNumber, title);
  await other.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(other.getByRole("main").getByRole("status")).toHaveText(`Du hast „${title}“ übernommen.`);
  await context.close();

  await logIn(page);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  // The managing is behind one closed fold (G22).
  await expect(main.getByRole("link", { name: "Titel und Eignung ändern" })).toBeHidden();
  await main.getByText("Verwalten", { exact: true }).click();
  await main.getByRole("link", { name: "Titel und Eignung ändern" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Titel und Eignung ändern · ${museumNumber}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expect(main.getByLabel("Titel")).toHaveValue(title);
  await expect(main.getByLabel("Für Helfer:innen geeignet")).toBeChecked();
  await expect(main).toContainText(`Ohne diese Markierung wird die Übernahme von E2E ${helper.username} aufgehoben.`);

  // An empty title is rejected, and what was typed is kept.
  await main.getByLabel("Titel").fill("");
  await main.getByLabel("Für Helfer:innen geeignet").uncheck();
  await main.getByRole("button", { name: "Defekt ändern" }).click();
  await expect(main.getByRole("alert")).toHaveText("Bitte einen Titel angeben.");
  await expect(main.getByLabel("Für Helfer:innen geeignet")).not.toBeChecked();

  const newTitle = unique("Left flipper rubber cracked");
  await main.getByLabel("Titel").fill(newTitle);
  await main.getByRole("button", { name: "Defekt ändern" }).click();

  await expect(main.getByRole("status")).toHaveText(
    `Der Titel ist jetzt „${newTitle}“. „${newTitle}“ ist nicht mehr für Helfer:innen geeignet. ` +
      `Die Übernahme von E2E ${helper.username} ist aufgehoben.`,
  );
  await expect(main.getByRole("heading", { level: 2, name: newTitle })).toBeVisible();
  await expect(main).toContainText("Nicht für Helfer:innen geeignet");
  await expect(main).not.toContainText("Übernommen von");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

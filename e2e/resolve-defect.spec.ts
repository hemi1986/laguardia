import type { Browser, Page } from "@playwright/test";
import {
  aHelper,
  allowPreview,
  anOpenDefect,
  expect,
  logIn,
  openDefect,
  pageWidth,
  TECHNICIAN,
  test,
} from "./fixtures";

/**
 * Resolving a defect on a phone (ST-028): the defect's page → „Beheben“ → the form with the closing note → back on the
 * defect's page with the confirmation and how it ended; gone from the open defects list and the visitor machine page.
 * Needs the e2e technician each local run creates (ST-083, named „E2E Technician“); the preview database has none
 * before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

const closingNote = (page: Page) => page.getByLabel("Abschlussnotiz");
const NOTE = "Coil stop replaced, flipper tested for 20 minutes";

/** What a visitor's phone shows for the machine – in a context without a session. */
async function visitorMachinePage(browser: Browser, baseURL: string | undefined, museumNumber: string) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const visitor = await context.newPage();
  await allowPreview(visitor, baseURL);
  await visitor.goto(`/m/${museumNumber}`);
  const text = await visitor.getByRole("main").innerText();
  await context.close();
  return text;
}

test("a technician resolves a defect: it is confirmed, shows how it ended and is gone for team and visitors", async ({
  page,
  browser,
  baseURL,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  expect(await visitorMachinePage(browser, baseURL, museumNumber)).toContain(title);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await main.getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(main).toContainText("Von dir übernommen");

  await main.getByRole("link", { name: "Beheben", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Defekt beheben · ${museumNumber}`);
  await expect(main).toContainText(title);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await closingNote(page).fill(NOTE);
  await page.getByRole("button", { name: "Als behoben eintragen" }).click();

  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ behoben.`);
  await expect(main).toContainText(NOTE);
  await expect(main).toContainText(`Behoben von ${TECHNICIAN} am `);
  // It is no longer claimed or open, and nothing more can be done to it here.
  await expect(main).not.toContainText("bernommen");
  await expect(main).not.toContainText("offen seit");
  await expect(main.getByRole("link", { name: "Beheben", exact: true })).toHaveCount(0);
  await expect(main.getByRole("button", { name: /bernehmen/ })).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // Gone from the open defects list and from the visitor machine page.
  await page.goto(`/team/defects?machine=${museumNumber}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Defekte");
  await expect(page.getByRole("main")).toContainText(/hat keine offenen Defekte\.|Kein Defekt ist offen\./);
  await expect(page.getByRole("main").getByRole("link", { name: title })).toHaveCount(0);
  expect(await visitorMachinePage(browser, baseURL, museumNumber)).not.toContain(title);
});

test("a helper is offered resolving only for a defect suitable for helpers", async ({ page }) => {
  await logIn(page);
  const notForHelpers = await anOpenDefect(page);
  const forHelpers = await anOpenDefect(page, { suitableForHelpers: true });
  const helper = await aHelper(page);
  await logIn(page, helper);

  await openDefect(page, notForHelpers.museumNumber, notForHelpers.title);
  await expect(page.getByRole("main").getByRole("link", { name: "Beheben", exact: true })).toHaveCount(0);
  // The form's address says why instead of offering a form that can only be rejected.
  await page.goto(`${page.url()}/beheben`);
  await expect(page.getByRole("main")).toContainText("Dieser Defekt ist nicht für Helfer:innen geeignet.");
  await expect(closingNote(page)).toHaveCount(0);

  await openDefect(page, forHelpers.museumNumber, forHelpers.title);
  await page.getByRole("main").getByRole("link", { name: "Beheben", exact: true }).click();
  await closingNote(page).fill("Rubber replaced");
  await page.getByRole("button", { name: "Als behoben eintragen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Du hast „${forHelpers.title}“ behoben.`);
  await expect(page.getByRole("main")).toContainText(`Behoben von E2E ${helper.username} am `);
});

test("a defect resolved meanwhile is said so at the form, which keeps the closing note", async ({ page, browser }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  const helper = await aHelper(page);
  await logIn(page);
  await openDefect(page, museumNumber, title);
  await page.getByRole("main").getByRole("link", { name: "Beheben", exact: true }).click();
  await closingNote(page).fill(NOTE);

  // Meanwhile on a second phone: the helper resolves the same defect.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await context.newPage();
  await logIn(other, helper);
  await openDefect(other, museumNumber, title);
  await other.getByRole("main").getByRole("link", { name: "Beheben", exact: true }).click();
  await closingNote(other).fill("Rubber replaced");
  await other.getByRole("button", { name: "Als behoben eintragen" }).click();
  await expect(other.getByRole("main").getByRole("status")).toHaveText(`Du hast „${title}“ behoben.`);
  await context.close();

  await page.getByRole("button", { name: "Als behoben eintragen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dieser Defekt ist nicht mehr offen.");
  await expect(page).toHaveURL(/\/beheben$/);
  await expect(closingNote(page)).toHaveValue(NOTE);
  // How it ended is the helper's closing note, not this one.
  await page.getByRole("main").getByRole("link", { name: "Zurück zum Defekt" }).click();
  await expect(page.getByRole("main")).toContainText("Rubber replaced");
  await expect(page.getByRole("main")).not.toContainText(NOTE);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a defect is resolved, and a missing closing note is asked for", async ({ page }) => {
    await logIn(page);
    const { museumNumber, title } = await anOpenDefect(page);
    await openDefect(page, museumNumber, title);
    await page.getByRole("main").getByRole("link", { name: "Beheben", exact: true }).click();

    await page.getByRole("button", { name: "Als behoben eintragen" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Bitte kurz beschreiben, wie der Defekt behoben wurde.",
    );
    await expect(closingNote(page)).toHaveAttribute("aria-invalid", "true");
    await closingNote(page).fill(NOTE);
    await page.getByRole("button", { name: "Als behoben eintragen" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`Du hast „${title}“ behoben.`);
    await expect(page.getByRole("main")).toContainText(NOTE);
  });
});

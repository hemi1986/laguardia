import type { Browser, Locator, Page } from "@playwright/test";
import {
  aMachine,
  allowPreview,
  anOpenDefect,
  expect,
  logIn,
  openDefect,
  pageWidth,
  test,
  untickMaintenanceTasks,
} from "./fixtures";

/**
 * One page width (ST-089, UX guideline G16): every page has the same content column of at most 672 px – the box the
 * heading, fields, lists and sections sit in, without the page's outer margin –, a form page's fields and submit button
 * span it, and buttons on a list or a record stay as wide as their words. Measured in a workshop PC's window.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password, "needs the e2e technician account");
});

const COLUMN = 672;
const workshopPc = { width: 1280, height: 800 };

/** Left edge and width of the page's content column: `main` without its padding. */
async function contentColumn(page: Page): Promise<{ left: number; width: number }> {
  return page.getByRole("main").evaluate((main) => {
    const style = getComputedStyle(main);
    const box = main.getBoundingClientRect();
    const paddingLeft = parseFloat(style.paddingLeft);
    return { left: box.left + paddingLeft, width: box.width - paddingLeft - parseFloat(style.paddingRight) };
  });
}

async function widthOf(locator: Locator): Promise<number> {
  return (await locator.boundingBox())!.width;
}

/** A browser without a session, as wide as the workshop PC – for the login and the visitor's pages. */
async function workshopPcWithoutSession(browser: Browser) {
  const context = await browser.newContext({ locale: "de-DE", viewport: workshopPc });
  const page = await context.newPage();
  await allowPreview(page, test.info().project.use.baseURL);
  return page;
}

test.describe("on the workshop PC", () => {
  test.use({ viewport: workshopPc });

  test("ST-089: A list and its form page have the same width", async ({ page }) => {
    await logIn(page);

    await page.goto("/team/maintenance-plan");
    const list = await contentColumn(page);
    const navigation = await page
      .getByRole("navigation", { name: "Navigation" })
      .getByRole("link")
      .first()
      .boundingBox();
    await page.getByRole("link", { name: "Wartungsaufgabe hinzufügen" }).click();
    await expect(page).toHaveURL(/\/team\/maintenance-plan\/new$/);
    const form = await contentColumn(page);

    expect(list.width).toBeCloseTo(COLUMN, 0);
    expect(form.width).toBeCloseTo(COLUMN, 0);
    expect(form.left).toBeCloseTo(list.left, 0);
    expect(navigation!.x).toBeCloseTo(list.left, 0);
  });

  test("ST-089: Records, dashboards, login, visitor, legal and not-found pages have the one width", async ({
    page,
    browser,
  }) => {
    await logIn(page);
    const { museumNumber, title } = await anOpenDefect(page);

    await page.goto(`/team/machines/${museumNumber}`);
    expect((await contentColumn(page)).width).toBeCloseTo(COLUMN, 0);
    await openDefect(page, museumNumber, title);
    expect((await contentColumn(page)).width).toBeCloseTo(COLUMN, 0);
    await page.goto("/team");
    expect((await contentColumn(page)).width).toBeCloseTo(COLUMN, 0);

    const visitor = await workshopPcWithoutSession(browser);
    for (const address of ["/login", `/m/${museumNumber}`, "/datenschutz", "/gibt-es-nicht"]) {
      await visitor.goto(address);
      expect((await contentColumn(visitor)).width, address).toBeCloseTo(COLUMN, 0);
    }
  });

  test("ST-089: Fields and the submit button span the column of a form page", async ({ page }) => {
    await logIn(page);

    await page.goto("/team/machines/new");
    const column = await contentColumn(page);
    const fields = page.getByRole("main").locator("input:not([type=hidden]):not([type=checkbox]), select, textarea");

    expect(column.width).toBeCloseTo(COLUMN, 0);
    expect(await fields.count()).toBeGreaterThan(0);
    for (const field of await fields.all()) {
      if (!(await field.isVisible())) continue;
      expect(await widthOf(field), (await field.getAttribute("name")) ?? "").toBeCloseTo(column.width, 0);
    }
    expect(await widthOf(page.getByRole("button", { name: "Gerät erfassen" }))).toBeCloseTo(column.width, 0);
  });

  test("ST-089: Filter forms, one-tap buttons and buttons on a record stay as wide as their words", async ({
    page,
  }) => {
    await logIn(page);
    const { museumNumber, title } = await anOpenDefect(page);

    await page.goto("/team/maintenance");
    const column = await contentColumn(page);
    expect(await widthOf(page.getByRole("button", { name: "Filtern" }))).toBeLessThan(column.width / 3);
    await openDefect(page, museumNumber, title);
    expect(await widthOf(page.getByRole("button", { name: "Übernehmen" }))).toBeLessThan(column.width / 3);
    await page.goto(`/team/machines/${museumNumber}`);
    expect(await widthOf(page.getByRole("link", { name: "Status ändern" }))).toBeLessThan(column.width / 3);
  });

  test("ST-089: The sticker print page follows the paper", async ({ page }) => {
    await logIn(page);
    const machines = [await aMachine(page), await aMachine(page), await aMachine(page)];

    await page.goto(`/team/machines/stickers/print?${machines.map((m) => `m=${m.museumNumber}`).join("&")}`);

    const sheet = page.locator(".sticker-page").first();
    await expect(sheet).toBeVisible();
    // A4 is 210 mm wide – 794 CSS pixels at 96 per inch.
    expect(await widthOf(sheet)).toBeCloseTo(794, 0);
  });
});

test("ST-089: No page scrolls sideways at 360 px", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page);

  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await untickMaintenanceTasks(page);
  await page.getByLabel("Museumsnummer").fill("42");
  await page.getByLabel("Standort").fill("Hall 2");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.goto("/team/maintenance-plan");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.goto(`/team/machines/${museumNumber}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

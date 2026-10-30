import type { Page } from "@playwright/test";
import { aHelper, aMachine, expect, logIn, pageWidth, test, unique } from "./fixtures";

/**
 * Moving a machine on a phone (ST-034): from the machine record to its own page and back. Needs a technician account
 * to register the machine: locally the e2e technician each local run creates (ST-083); the preview database has none
 * before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** From the machine record to the move page, the way a team member gets there. */
async function openMove(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  await page.getByRole("link", { name: "Standort ändern" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Standort ändern · ${museumNumber}`);
}

const locationOnRecord = (page: Page) =>
  page
    .getByRole("main")
    .locator("dl div")
    .filter({ has: page.locator("dt", { hasText: "Standort" }) });

test("ST-034: Helper moves a machine", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page, undefined, "Hall 2, row 3");
  const anna = await aHelper(page);
  await logIn(page, anna);
  const workshop = unique("Workshop");

  await openMove(page, museumNumber);
  await expect(page.getByLabel("Standort")).toHaveValue("Hall 2, row 3");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await page.getByLabel("Standort").fill(workshop);
  await page.getByRole("button", { name: "Standort ändern" }).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?`));
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} steht jetzt in „${workshop}“.`);
  await expect(locationOnRecord(page)).toContainText(workshop);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.goto(`/team/machines?search=${museumNumber}`);
  await expect(page.getByRole("article").filter({ hasText: museumNumber })).toContainText(workshop);
});

test("a rejected move stays on the form and keeps the typed text", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page, undefined, "Hall 2, row 3");
  await openMove(page, museumNumber);

  await page.getByLabel("Standort").fill("");
  await page.getByRole("button", { name: "Standort ändern" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Standort angeben.");
  await expect(page.getByLabel("Standort")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Standort").fill(" Hall 2, row 3 ");
  await page.getByRole("button", { name: "Standort ändern" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(`${museumNumber} steht schon in „Hall 2, row 3“.`);
  await expect(page.getByLabel("Standort")).toHaveValue(" Hall 2, row 3 ");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Standort ändern · ${museumNumber}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a move is saved, and a rejected one keeps the typed text", async ({ page }) => {
    await logIn(page);
    const { museumNumber } = await aMachine(page, undefined, "Hall 2, row 3");
    await openMove(page, museumNumber);

    await page.getByLabel("Standort").fill("   ");
    await page.getByRole("button", { name: "Standort ändern" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Standort angeben.");
    await expect(page.getByLabel("Standort")).toHaveValue("   ");

    await page.getByLabel("Standort").fill("Workshop");
    await page.getByRole("button", { name: "Standort ändern" }).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} steht jetzt in „Workshop“.`);
    await expect(locationOnRecord(page)).toContainText("Workshop");
  });
});

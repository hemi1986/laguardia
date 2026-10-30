import type { Browser, Page } from "@playwright/test";
import {
  aMachine,
  allowPreview,
  correctToAFreeNumber,
  expect,
  logIn,
  openCorrection,
  pageWidth,
  test,
} from "./fixtures";

/**
 * Correcting a machine's museum number or serial number on a phone (ST-035): from the machine record to its own page,
 * back under the new number, and the old QR sticker still leading to the machine. Needs the e2e technician each local
 * run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

async function visitorPhone(browser: Browser) {
  const context = await browser.newContext({ locale: "de-DE", viewport: { width: 360, height: 800 }, isMobile: true });
  const phone = await context.newPage();
  await allowPreview(phone, test.info().project.use.baseURL);
  return phone;
}

test("ST-035: Technician corrects a mistyped museum number", async ({ page }) => {
  await logIn(page);
  const { museumNumber: mistyped, title } = await aMachine(page);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  const corrected = await correctToAFreeNumber(page, mistyped);

  const main = page.getByRole("main");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${corrected} · ${title}`);
  await expect(main.getByRole("status")).toHaveText(
    `${mistyped} heißt jetzt ${corrected}. Bitte einen neuen QR-Sticker drucken.`,
  );
  await expect(main).toContainText("Erfasst als Spielbereit"); // its status history came along
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await main.getByRole("link", { name: "QR-Sticker drucken" }).click();
  await expect(page.getByRole("img", { name: `QR-Code ${corrected}` })).toBeVisible();
});

test("ST-035: Old QR sticker keeps working", async ({ page, browser }) => {
  await logIn(page);
  const { museumNumber: old, title } = await aMachine(page);
  const corrected = await correctToAFreeNumber(page, old);

  const phone = await visitorPhone(browser);
  await phone.goto(`/m/${old}`);
  await expect(phone).toHaveURL(new RegExp(`/m/${corrected}$`));
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText(title);
  await phone.context().close();

  // A reserved museum number in a team address leads there too (ST-035 foundation).
  await page.goto(`/team/machines/${old}`);
  await expect(page).toHaveURL(new RegExp(`/team/machines/${corrected}$`));
  await page.goto(`/team/machines/${old}/angaben`);
  await expect(page).toHaveURL(new RegExp(`/team/machines/${corrected}/angaben$`));
});

test("a reserved museum number leads every page of the machine to the same page under its current one", async ({
  page,
  browser,
}) => {
  await logIn(page);
  const { museumNumber: old } = await aMachine(page);
  const corrected = await correctToAFreeNumber(page, old);

  for (const sub of ["/standort", "/wartungseintraege", "/reparaturhistorie?jahr=2026", "/melden"]) {
    await page.goto(`/team/machines/${old}${sub}`);
    await expect(page).toHaveURL(`/team/machines/${corrected}${sub}`);
  }
  const phone = await visitorPhone(browser);
  await phone.goto(`/m/${old}/melden`);
  await expect(phone).toHaveURL(new RegExp(`/m/${corrected}/melden$`));
  await phone.context().close();
});

test("a serial number added later shows on the machine record", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await openCorrection(page, museumNumber);

  await page.getByLabel("Seriennummer").fill("MM-12345");
  await page.getByRole("button", { name: "Angaben korrigieren" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Angaben von ${museumNumber} korrigiert.`);
  await expect(page.getByRole("main").locator("dl")).toContainText("MM-12345");
});

test("a rejected correction stays on the form and keeps the typed text", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await openCorrection(page, museumNumber);

  await page.getByLabel("Museumsnummer").fill("42");
  await page.getByRole("button", { name: "Angaben korrigieren" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte die Museumsnummer als „LG-“ mit drei Ziffern angeben, zum Beispiel LG-042.",
  );
  await expect(page.getByLabel("Museumsnummer")).toHaveValue("42");
  await expect(page.getByLabel("Museumsnummer")).toHaveAttribute("aria-invalid", "true");
});

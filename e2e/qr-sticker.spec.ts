import type { Browser, Page } from "@playwright/test";
import { allowPreview, expect, test } from "./fixtures";

/**
 * QR stickers (ST-011): printing them, and what the address on them opens for a visitor and for a logged-in team
 * member. Needs the e2e technician each local run creates (ST-083); the preview database has no machine before ST-068.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A machine registered by the logged-in technician; returns its museum number and machine model title. */
async function aRegisteredMachine(page: Page) {
  const title = `Medieval Madness ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 1");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  return { museumNumber, title };
}

async function visitorPhone(browser: Browser) {
  const context = await browser.newContext({ locale: "de-DE", viewport: { width: 360, height: 800 }, isMobile: true });
  const phone = await context.newPage();
  await allowPreview(phone, test.info().project.use.baseURL);
  return phone;
}

test("ST-011: Technician prints a QR sticker", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aRegisteredMachine(page);

  await page.getByRole("navigation", { name: "Navigation" }).getByRole("link", { name: "Geräte" }).click();
  await page.getByRole("link", { name: "QR-Sticker drucken" }).click();
  await expect(page).toHaveURL(/\/team\/machines\/stickers$/);
  await page.getByLabel("Suche").fill(title);
  await page.getByRole("button", { name: "Suchen" }).click();
  await page.getByLabel(`${museumNumber} · ${title}`).check();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("1 Gerät gewählt");
  await page.getByRole("button", { name: "QR-Sticker drucken" }).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/stickers/print\\?m=${museumNumber}&search=`));
  await expect(page.getByRole("img", { name: `QR-Code ${museumNumber}` })).toBeVisible();
  await expect(page.getByText(museumNumber, { exact: true })).toBeVisible();
  await expect(page.getByText("Problem? Scan mich!")).toBeVisible();
  await expect(page.getByText("Problem? Scan me!")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigation" })).toHaveCount(0); // the page is what is printed
  await page.getByRole("link", { name: "Zurück zur Auswahl" }).click(); // G17: a way back without the browser
  await expect(page).toHaveURL(/\/team\/machines\/stickers\?search=/);
});

test("ST-011: Visitor scans the sticker", async ({ page, browser }) => {
  await logIn(page);
  const { museumNumber, title } = await aRegisteredMachine(page);
  const phone = await visitorPhone(browser);

  await phone.goto(`/m/${museumNumber}`);

  await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}$`));
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(phone.getByRole("link", { name: "Problem melden" })).toBeVisible();
});

test("ST-011: Team member scans the sticker", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aRegisteredMachine(page);

  await page.goto(`/m/${museumNumber}`);

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${museumNumber} · ${title}`);
  await expect(page.getByRole("heading", { name: "Status-Historie" })).toBeVisible();
});

test("ST-011: Visitor and team member scan one after the other", async ({ page, browser }) => {
  await logIn(page);
  const { museumNumber } = await aRegisteredMachine(page);
  await page.goto(`/m/${museumNumber}`);
  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}$`));

  const phone = await visitorPhone(browser);
  await phone.goto(`/m/${museumNumber}`);

  await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}$`));
  await expect(phone.getByRole("link", { name: "Problem melden" })).toBeVisible();
  await expect(phone.getByRole("heading", { name: "Status-Historie" })).toHaveCount(0);
});

test("ST-011: No machine chosen for printing", async ({ page }) => {
  await logIn(page);
  await aRegisteredMachine(page);
  await page.goto("/team/machines/stickers");

  await page.getByRole("button", { name: "QR-Sticker drucken" }).click();

  await expect(page).toHaveURL(/\/team\/machines\/stickers\?error=none$/);
  // Right above the button (G8): the alert and the button are neighbours in the form.
  const form = page.locator("form", { has: page.getByRole("button", { name: "QR-Sticker drucken" }) });
  await expect(form.getByRole("alert")).toHaveText("Bitte mindestens ein Gerät auswählen.");
  await expect(page.getByRole("img", { name: /QR-Code/ })).toHaveCount(0);
});

test("ST-011: Finding the machines to print for", async ({ page }) => {
  await logIn(page);
  const first = await aRegisteredMachine(page);
  const second = await aRegisteredMachine(page);
  await page.goto("/team/machines/stickers");

  await page.getByLabel("Suche").fill(first.title);
  await page.getByRole("button", { name: "Suchen" }).click();

  await expect(page.getByLabel(`${first.museumNumber} · ${first.title}`)).toBeVisible();
  await expect(page.getByLabel(`${second.museumNumber} · ${second.title}`)).toHaveCount(0);
  await page.getByLabel(`${first.museumNumber} · ${first.title}`).check();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("1 Gerät gewählt");
  await page.goto("/team/machines/stickers");
  await page.getByLabel("Suche").fill(first.museumNumber.slice(3));
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByLabel(`${first.museumNumber} · ${first.title}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

import type { Browser, Page } from "@playwright/test";
import { allowPreview, expect, groupOf, logIn, pageWidth, test, tickMachines, aMachine } from "./fixtures";

/**
 * QR stickers (ST-011): printing them, and what the address on them opens for a visitor and for a logged-in team
 * member. Needs the e2e technician each local run creates (ST-083); the preview database has no machine before ST-068.
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

test("ST-011: Technician prints a QR sticker", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page);

  await page.getByRole("navigation", { name: "Navigation" }).getByRole("link", { name: "Geräte" }).click();
  await page.getByRole("link", { name: "QR-Sticker drucken" }).click();
  await expect(page).toHaveURL(/\/team\/machines\/stickers$/);
  await page.getByLabel("Suche").fill(title);
  await page.getByRole("button", { name: "Suchen" }).click();
  await page.getByLabel(`${museumNumber} · ${title}`).check();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("1 Gerät ausgewählt");
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
  const { museumNumber, title } = await aMachine(page);
  const phone = await visitorPhone(browser);

  await phone.goto(`/m/${museumNumber}`);

  await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}$`));
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(phone.getByRole("link", { name: "Problem melden" })).toBeVisible();
});

test("ST-011: Team member scans the sticker", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page);

  await page.goto(`/m/${museumNumber}`);

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${museumNumber} · ${title}`);
  await expect(page.getByRole("heading", { name: "Status-Historie" })).toBeVisible();
});

test("ST-011: Visitor and team member scan one after the other", async ({ page, browser }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
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
  await aMachine(page);
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
  const first = await aMachine(page);
  const second = await aMachine(page);
  await page.goto("/team/machines/stickers");

  await page.getByLabel("Suche").fill(first.title);
  await page.getByRole("button", { name: "Suchen" }).click();

  await expect(page.getByLabel(`${first.museumNumber} · ${first.title}`)).toBeVisible();
  await expect(page.getByLabel(`${second.museumNumber} · ${second.title}`)).toHaveCount(0);
  await page.getByLabel(`${first.museumNumber} · ${first.title}`).check();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("1 Gerät ausgewählt");
  await page.goto("/team/machines/stickers");
  await page.getByLabel("Suche").fill(first.museumNumber.slice(3));
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByLabel(`${first.museumNumber} · ${first.title}`)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

/** An EM pinball machine and a CRT arcade machine – two groups of the sticker selection (ST-098). */
async function machinesOfTwoGroups(page: Page) {
  const em = await aMachine(page, undefined, undefined, { technology: "em" });
  const crt = await aMachine(page, undefined, undefined, { machineCategory: "arcade", technology: "crt" });
  return { em, crt };
}

/** The header of the group holding that machine, and how many machines the group holds – closed or open. */
async function headerOf(page: Page, museumNumber: string) {
  const group = groupOf(page, museumNumber);
  return { header: group.locator("summary > span"), total: await group.locator('input[type="checkbox"]').count() };
}

test("ST-098: Stickers for machines of two groups", async ({ page }) => {
  await logIn(page);
  const { em, crt } = await machinesOfTwoGroups(page);
  await page.goto("/team/machines/stickers");

  await tickMachines(page, em, crt);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: "QR-Sticker drucken" }).click();

  await expect(page).toHaveURL(/\/team\/machines\/stickers\/print\?/);
  await expect(page.getByRole("img", { name: /QR-Code/ })).toHaveCount(2);
  await expect(page.getByRole("img", { name: `QR-Code ${em.museumNumber}` })).toBeVisible();
  await expect(page.getByRole("img", { name: `QR-Code ${crt.museumNumber}` })).toBeVisible();
});

test("ST-098: Choosing nothing is still rejected and opens nothing", async ({ page }) => {
  await logIn(page);
  await aMachine(page);
  await page.goto("/team/machines/stickers");

  await page.getByRole("button", { name: "QR-Sticker drucken" }).click();

  await expect(page).toHaveURL(/\/team\/machines\/stickers\?error=none$/);
  await expect(page.getByRole("img", { name: /QR-Code/ })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte mindestens ein Gerät auswählen.");
  await expect(page.locator("details").first()).toBeVisible();
  await expect(page.locator("details[open]")).toHaveCount(0);
});

test("ST-098: The chosen count stays next to the way to print", async ({ page }) => {
  await logIn(page);
  const { em, crt } = await machinesOfTwoGroups(page);
  await page.goto("/team/machines/stickers");
  await tickMachines(page, em, crt);
  for (const { museumNumber } of [em, crt]) await groupOf(page, museumNumber).locator("summary > span").click();
  await expect(page.locator("details[open]")).toHaveCount(0);

  await expect(page.getByRole("main").getByRole("status")).toHaveText("2 Geräte ausgewählt");
  const emGroup = await headerOf(page, em.museumNumber);
  await expect(emGroup.header).toHaveText(`Flipper · EM – 1 von ${emGroup.total} ausgewählt`);
  const crtGroup = await headerOf(page, crt.museumNumber);
  await expect(crtGroup.header).toHaveText(`Arcade · CRT – 1 von ${crtGroup.total} ausgewählt`);
});

test("ST-098: A new search starts a new choice", async ({ page }) => {
  await logIn(page);
  const { em, crt } = await machinesOfTwoGroups(page);
  await page.goto("/team/machines/stickers");
  await tickMachines(page, em);

  await page.getByLabel("Suche").fill(crt.title);
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page.getByLabel(`${crt.museumNumber} · ${crt.title}`)).toBeVisible();
  await page.getByLabel("Suche").fill("");
  await page.getByRole("button", { name: "Suchen" }).click();

  await expect(page).toHaveURL(/\/team\/machines\/stickers\?search=$/);
  // Its group is closed again, so the checkbox is not offered to the accessibility tree – it is read in the page.
  await expect(page.locator(`input[value="${em.museumNumber}"]`)).not.toBeChecked();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("0 Geräte ausgewählt");
});

test.describe("the sticker selection without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("ST-098: Without JavaScript the header keeps the count of when the page opened", async ({ page }) => {
    await logIn(page);
    const em = await aMachine(page, undefined, undefined, { technology: "em" });
    await page.goto("/team/machines/stickers");

    await tickMachines(page, em);

    const group = await headerOf(page, em.museumNumber);
    await expect(group.header).toHaveText(`Flipper · EM – 0 von ${group.total} ausgewählt`);
    await expect(groupOf(page, em.museumNumber).getByRole("button", { name: "Alle auswählen" })).toHaveCount(0);
    await page.getByRole("button", { name: "QR-Sticker drucken" }).click();
    await expect(page.getByRole("img", { name: /QR-Code/ })).toHaveCount(1);
    await expect(page.getByRole("img", { name: `QR-Code ${em.museumNumber}` })).toBeVisible();
  });
});

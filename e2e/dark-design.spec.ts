import type { Browser, Locator, Page } from "@playwright/test";
import { aHelper, aMachine, aTeamMember, allowPreview, expect, logIn, openMore, test } from "./fixtures";

/**
 * The dark design and the switch to light per device (ST-090, UX guideline G26). A page or a control "is in the dark
 * design" when its computed colour scheme is dark – not by comparing pixels (lead dev, story review 2026-10-25).
 * Every test runs on a device set to a light system design, which no page follows.
 */
test.use({ colorScheme: "light" });

const designOf = (target: Page | Locator) =>
  "evaluate" in target && "goto" in target
    ? target.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
    : (target as Locator).evaluate((element) => getComputedStyle(element).colorScheme);

/** A phone of its own beside the test's page – no session, no design chosen, set to a light system design. */
async function anotherDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    colorScheme: "light",
    locale: "de-DE",
    viewport: { width: 360, height: 800 },
  });
  const page = await context.newPage();
  await allowPreview(page, test.info().project.use.baseURL);
  return page;
}

/** The entries under „Mehr“, in their order. */
async function entriesOfMore(page: Page): Promise<string[]> {
  await openMore(page);
  return page.getByRole("navigation").locator("details li").allInnerTexts();
}

async function choose(page: Page, entry: "Helles Design" | "Dunkles Design") {
  await openMore(page);
  await page.getByRole("button", { name: entry }).click();
}

async function logOut(page: Page) {
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test("ST-090: Pages open dark although the device is set to light", async ({ page, browser }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);

  await page.goto("/team/machines");
  expect(await designOf(page)).toBe("dark");

  const visitor = await anotherDevice(browser);
  await visitor.goto(`/m/${museumNumber}`);
  expect(await designOf(visitor)).toBe("dark");
});

test("ST-090: A team member switches the device to light", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await page.goto(`/team/machines/${museumNumber}`);
  expect(await designOf(page)).toBe("dark");
  const before = await entriesOfMore(page);

  await choose(page, "Helles Design");

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(museumNumber);
  await expect.poll(() => designOf(page)).toBe("light");
  expect(await entriesOfMore(page)).toEqual(before.map((entry) => (entry === "Helles Design" ? "Dunkles Design" : entry)));
});

test("ST-090: Switching on a filtered list keeps the filter", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page);
  await page.goto("/team/machines");
  await page.getByLabel("Suche").fill(title);
  await page.getByRole("button", { name: "Suchen" }).click();
  await expect(page).toHaveURL(/search=/);
  const filtered = page.url();

  await choose(page, "Helles Design");

  await expect.poll(() => designOf(page)).toBe("light");
  expect(page.url()).toBe(filtered);
  await expect(page.getByLabel("Suche")).toHaveValue(title);
  await expect(page.getByRole("main").getByText(museumNumber)).toBeVisible();
  await expect(page.getByRole("main").getByText(/LG-\d{3}/)).toHaveCount(1);
});

test("ST-090: The switch sits between „Passwort ändern“ and „Abmelden“", async ({ page }) => {
  await logIn(page);
  const helper = await aHelper(page);
  await logIn(page, helper);

  expect((await entriesOfMore(page)).slice(-3)).toEqual(["Passwort ändern", "Helles Design", "Abmelden"]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("ST-090: Switching works without JavaScript", async ({ page }) => {
    await logIn(page);
    await page.goto("/team/defects");
    expect(await designOf(page)).toBe("dark");

    await choose(page, "Helles Design");

    await expect(page).toHaveURL(/\/team\/defects$/);
    expect(await designOf(page)).toBe("light");
  });
});

test("ST-090: The choice belongs to the device", async ({ page, browser }) => {
  await logIn(page);
  const anna = await aTeamMember(page, { name: "Anna" });
  await logOut(page);
  await logIn(page, anna);
  await choose(page, "Helles Design");
  await expect.poll(() => designOf(page)).toBe("light");

  const phone = await anotherDevice(browser);
  await logIn(phone, anna);
  expect(await designOf(phone)).toBe("dark");

  await logOut(page);
  await logIn(page, anna);
  expect(await designOf(page)).toBe("light");
});

/** The logged-in team member switches this device to light and logs out. */
async function switchedToLightAndLoggedOut(page: Page) {
  await page.goto("/team");
  await choose(page, "Helles Design");
  await expect.poll(() => designOf(page)).toBe("light");
  await logOut(page);
}

test("ST-090: The login and the team not-found page follow the device's choice", async ({ page, browser }) => {
  await logIn(page);
  await switchedToLightAndLoggedOut(page);

  expect(await designOf(page)).toBe("light");
  // From the start page (always dark) to the login by its link – with JavaScript the page is not loaded anew.
  await page.goto("/");
  expect(await designOf(page)).toBe("dark");
  await page.getByRole("link", { name: "Team login" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => designOf(page)).toBe("light");
  const missing = await page.goto("/team/gibt-es-nicht");
  expect(missing?.status()).toBe(404);
  expect(await designOf(page)).toBe("light");

  const withoutChoice = await anotherDevice(browser);
  await withoutChoice.goto("/login");
  expect(await designOf(withoutChoice)).toBe("dark");
  await withoutChoice.goto("/team/gibt-es-nicht");
  expect(await designOf(withoutChoice)).toBe("dark");
});

test("ST-090: Visitor and legal pages are always dark and offer no switch", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await switchedToLightAndLoggedOut(page);

  for (const address of [`/m/${museumNumber}`, "/datenschutz", "/m/gibt-es-nicht/melden", "/gibt-es-nicht"]) {
    await page.goto(address);
    expect(await designOf(page), address).toBe("dark");
    await expect(page.getByRole("button", { name: /Design/ }), address).toHaveCount(0);
  }
});

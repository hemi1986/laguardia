import type { Browser, Locator, Page } from "@playwright/test";
import { aMachine, allowPreview, expect, logIn, test } from "./fixtures";

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

test("ST-090: Pages open dark although the device is set to light", async ({ page, browser }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);

  await page.goto("/team/machines");
  expect(await designOf(page)).toBe("dark");

  const visitor = await anotherDevice(browser);
  await visitor.goto(`/m/${museumNumber}`);
  expect(await designOf(visitor)).toBe("dark");
});

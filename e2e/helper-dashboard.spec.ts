import type { Page } from "@playwright/test";
import { aHelper, anOpenDefect, expect, logIn, openMore, pageWidth, test } from "./fixtures";

/**
 * The helper dashboard on a phone (ST-049): where a helper lands after logging in. Needs the e2e technician each local
 * run creates (ST-083) to create the helper; the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("ST-049: A helper lands on their dashboard after logging in", async ({ page }) => {
  await logIn(page);
  const helper = await aHelper(page);

  await logIn(page, helper);

  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Übersicht");
  // A new helper claims nothing – with other tests' defects open, the first section says so; else nothing is open.
  await expect(page.getByRole("main")).toContainText(
    /Du hast keinen Defekt übernommen\.|Gerade ist nichts für dich offen\./,
  );
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("the dashboard marks a defect recorded after the helper's first visit as new (ST-050)", async ({ page }) => {
  await logIn(page);
  const helper = await aHelper(page);
  await logIn(page, helper);
  // The first visit marks nothing; once the page is idle its client effect has recorded the visit (ADR 0011).
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Übersicht");
  await expect(page.getByRole("main")).not.toContainText("neu seit deinem letzten Besuch");
  await page.waitForLoadState("networkidle");
  await logOut(page);

  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  await logOut(page);
  await logIn(page, helper);

  // Within the hour of the first visit – the Last visit is still the first one, so the new defect is marked.
  const entry = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title }) });
  await expect(entry).toContainText(`${museumNumber} · `);
  await expect(entry).toContainText("neu seit deinem letzten Besuch");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

async function logOut(page: Page) {
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

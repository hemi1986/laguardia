import { aHelper, aMachine, expect, logIn, pageWidth, test } from "./fixtures";

/**
 * The technician dashboard on a phone (ST-048): where a technician lands after logging in, „Status ändern“ on a machine
 * that could return to play, and that a helper sees their own dashboard under „Übersicht“ instead (ST-049). Needs the
 * e2e technician each local run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("ST-048: A technician lands on their dashboard after logging in", async ({ page }) => {
  await logIn(page);

  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Übersicht");
  await expect(page.getByRole("main")).toContainText(
    /Meldungen zur Sichtung|Gerade braucht nichts deine Aufmerksamkeit\./,
  );
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-048: Returning a machine to play happens on the machine", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page, "out-of-order");

  await page.goto("/team");
  const entry = page.getByRole("main").getByRole("listitem").filter({ hasText: museumNumber });
  await expect(entry).toContainText("Außer Betrieb · kein offener Defekt");
  await entry.getByRole("link", { name: "Status ändern" }).click();

  await page.getByLabel("Status", { exact: true }).selectOption("playable");
  await page.getByLabel("Grund").fill("Repaired and tested");
  await page.getByRole("button", { name: "Status ändern" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} ist jetzt Spielbereit.`);
  await page.goto("/team");
  // No longer one to return to play – and since ST-058 the change itself is among the recent changes.
  await expect(entry.filter({ hasText: "kein offener Defekt" })).toHaveCount(0);
  await expect(page.getByRole("main").locator("section").filter({ hasText: "Letzte Änderungen" })).toContainText(
    `${museumNumber} Außer Betrieb → Spielbereit`,
  );
});

test("ST-048: Helpers cannot open the technician dashboard", async ({ page }) => {
  await logIn(page);
  await aMachine(page, "out-of-order");
  const helper = await aHelper(page);

  await logIn(page, helper);

  await expect(page).toHaveURL(/\/team$/);
  // Helpers land on their own dashboard instead (ST-049).
  await expect(page.getByRole("main")).toContainText(
    /Du hast keinen Defekt übernommen\.|Gerade ist nichts für dich offen\./,
  );
  await expect(page.getByRole("main")).not.toContainText("Nicht spielbereit ohne offenen Defekt");
  await expect(page.getByRole("main")).not.toContainText("Meldungen zur Sichtung");
});

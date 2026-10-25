import type { Page } from "@playwright/test";
import { aMachine, allowPreview, expect, logIn, pageWidth, test } from "./fixtures";

/**
 * Retired machines on a phone (ST-055): the machine overview's filter form lists them with the checkbox „Auch
 * ausgemusterte Geräte anzeigen“ – a plain GET form, so it works without JavaScript –, and the visitor machine page
 * behind an old QR sticker only says the machine is no longer in the museum. Needs the e2e technician each local run
 * creates (ST-083) – the preview database has none before ST-068, so this runs locally only.
 */
test.beforeEach(() => {
  test.skip(
    !process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD || !!process.env.BASE_URL,
    "needs a local technician account",
  );
});

/** A new machine, retired by the logged-in e2e technician through its machine record. */
async function aRetiredMachine(page: Page) {
  await logIn(page);
  const machine = await aMachine(page);
  await page.goto(`/team/machines/${machine.museumNumber}`);
  await page.getByRole("link", { name: "Gerät ausmustern" }).click();
  await page.getByLabel("Grund").fill("Sold to a collector");
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Endgültig ausmustern" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${machine.museumNumber} ist ausgemustert.`);
  return machine;
}

test("the filter form lists retired machines with the checkbox, marked „Ausgemustert“", async ({ page }) => {
  const { museumNumber, title } = await aRetiredMachine(page);
  const entry = page.getByRole("listitem").filter({ hasText: `${museumNumber} · ${title}` });

  await page.goto("/team/machines");
  await expect(entry).toHaveCount(0);

  await page.getByLabel("Auch ausgemusterte Geräte anzeigen").check();
  await page.getByRole("button", { name: "Suchen" }).click();

  await expect(page).toHaveURL(/retired=1/);
  await expect(entry).toContainText("Ausgemustert");
  await expect(page.getByLabel("Auch ausgemusterte Geräte anzeigen")).toBeChecked();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("the old QR sticker of a retired machine says it is no longer in the museum", async ({ page, browser }) => {
  const { museumNumber } = await aRetiredMachine(page);
  const visitor = await (await browser.newContext({ locale: "en-GB" })).newPage();
  await allowPreview(visitor, test.info().project.use.baseURL);

  await visitor.goto(`/m/${museumNumber}`);

  await expect(visitor.getByRole("main")).toContainText("This machine is no longer in the museum.");
  await expect(visitor.getByRole("link", { name: "Report a problem" })).toHaveCount(0);
  expect((await visitor.goto(`/m/${museumNumber}/melden`))?.status()).toBe(404);
  expect(await pageWidth(visitor)).toBeLessThanOrEqual(360);
  await visitor.context().close();
});

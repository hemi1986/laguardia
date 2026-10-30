import type { Page } from "@playwright/test";
import { anOpenDefect, expect, logIn, openDefectsEntry, pageWidth, reportAsVisitor, test } from "./fixtures";

/**
 * Retiring a machine on a phone (ST-039): section 9 of the machine record leads to „Ausmustern · LG-013“; sending the
 * reason asks once, naming what nobody sees on this screen (G10, G10b); afterwards the technician is back on the
 * machine record with the confirmation (G3). Needs the e2e technician each local run creates (ST-083) – the preview
 * database has none before ST-068, so this runs locally only.
 */
test.beforeEach(() => {
  test.skip(
    !process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD || !!process.env.BASE_URL,
    "needs a local technician account",
  );
});

/** A machine with 1 open defect and 2 untriaged problem reports – the technician is logged in again afterwards. */
async function aMachineWithOpenWork(page: Page) {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await reportAsVisitor(page, museumNumber, "Ball stuck in the scoop");
  await reportAsVisitor(page, museumNumber, "Left ramp rejects the ball");
  await logIn(page);
  return { museumNumber, defect: title };
}

/** The retire page, opened the way a technician gets there: the machine record → „Gerät ausmustern“. */
async function askToRetire(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  await page.getByRole("link", { name: "Gerät ausmustern" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Ausmustern · ${museumNumber}`);
  await page.getByLabel("Grund").fill("Sold to a collector");
  await page.getByRole("button", { name: "Gerät ausmustern" }).click();
}

const status = (page: Page) =>
  page
    .getByRole("main")
    .locator("dt", { hasText: /^Status$/ })
    .locator("+ dd");

test("ST-039: Retiring asks once and names what it closes", async ({ page, context }) => {
  const { museumNumber } = await aMachineWithOpenWork(page);

  await askToRetire(page, museumNumber);

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    `${museumNumber} ausmustern? 1 offener Defekt wird geschlossen, 2 Meldungen werden verworfen. Das lässt sich nicht rückgängig machen.`,
  );
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // Not retired until the technician confirms.
  const meanwhile = await context.newPage();
  await meanwhile.goto(`/team/machines/${museumNumber}`);
  await expect(status(meanwhile)).toHaveText("Spielbereit");
  await meanwhile.close();

  await page.getByRole("button", { name: "Endgültig ausmustern" }).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?retired=1$`));
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${museumNumber} ist ausgemustert.`);
  await expect(status(page)).toHaveText("Ausgemustert");
  await expect(page.getByRole("link", { name: "Gerät ausmustern" })).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-039: Going back from the question retires nothing", async ({ page }) => {
  const { museumNumber, defect } = await aMachineWithOpenWork(page);
  await askToRetire(page, museumNumber);

  await page.getByRole("button", { name: "Zurück", exact: true }).click();

  // Back at the form, the reason kept, no question.
  await expect(page.getByLabel("Grund")).toHaveValue("Sold to a collector");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.goto(`/team/machines/${museumNumber}`);
  await expect(status(page)).toHaveText("Spielbereit");
  await expect(await openDefectsEntry(page, museumNumber)).toContainText(defect);
  await page.goto("/team/triage");
  await expect(page.getByRole("main").getByRole("article").filter({ hasText: museumNumber })).toHaveCount(2);
});

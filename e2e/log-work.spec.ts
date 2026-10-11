import type { Page } from "@playwright/test";
import {
  aHelper,
  anOpenDefect,
  expect,
  logIn,
  openDefect,
  openDefectsEntry,
  pageWidth,
  TECHNICIAN,
  test,
} from "./fixtures";

/**
 * Logging work on a defect on a phone (ST-024): the defect's page → „Arbeitsschritt eintragen“ → the form → back on the
 * defect's page with the confirmation and the entry at the top of the work log; the open defects list names the last
 * work log entry. Needs the e2e technician each local run creates (ST-083, named „E2E Technician“); the preview
 * database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

const whatWasDone = (page: Page) => page.getByLabel("Was wurde gemacht?");
const partsUsed = (page: Page) => page.getByLabel("Verwendete Teile (optional)");
const submit = (page: Page) => page.getByRole("button", { name: "Arbeitsschritt eintragen" });

async function openLogWork(page: Page, museumNumber: string, title: string) {
  await openDefect(page, museumNumber, title);
  await page.getByRole("main").getByRole("link", { name: "Arbeitsschritt eintragen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Arbeitsschritt eintragen · ${museumNumber}`);
}

test("a technician logs work twice: confirmed, newest first on the defect's page, and named in the list", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main).toContainText("Noch kein Arbeitsschritt eingetragen.");
  await expect(await openDefectsEntry(page, museumNumber)).not.toContainText("Letzter Arbeitsschritt");

  await openLogWork(page, museumNumber, title);
  await expect(main).toContainText(title);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await whatWasDone(page).fill("Checked the coil");
  await submit(page).click();
  await expect(main.getByRole("status")).toHaveText(`Arbeitsschritt zu „${title}“ eingetragen.`);
  await expect(main).not.toContainText("Verwendete Teile:");

  await openLogWork(page, museumNumber, title);
  await whatWasDone(page).fill("Replaced coil stop and EOS switch");
  await partsUsed(page).fill("1x coil stop, 1x EOS switch");
  await submit(page).click();

  await expect(main.getByRole("status")).toHaveText(`Arbeitsschritt zu „${title}“ eingetragen.`);
  const entries = main
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Arbeitsschritte" }) })
    .getByRole("article");
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText("Replaced coil stop and EOS switch");
  await expect(entries.nth(0)).toContainText("Verwendete Teile: 1x coil stop, 1x EOS switch");
  await expect(entries.nth(0)).toContainText(TECHNICIAN);
  await expect(entries.nth(1)).toContainText("Checked the coil");
  // Logging work is not claiming, and the defect stays open.
  await expect(main).not.toContainText("bernommen von");
  await expect(main).toContainText("offen seit");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expect(await openDefectsEntry(page, museumNumber)).toContainText(/Letzter Arbeitsschritt: .+ · E2E Technician/);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("a helper logs work on a defect not suitable for helpers; a missing text is asked for and the parts are kept", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  const helper = await aHelper(page);
  await logIn(page, helper);
  await openLogWork(page, museumNumber, title);

  await partsUsed(page).fill("1x rubber ring");
  await submit(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte kurz beschreiben, was gemacht wurde.");
  await expect(whatWasDone(page)).toHaveAttribute("aria-invalid", "true");
  await expect(partsUsed(page)).toHaveValue("1x rubber ring");
  await whatWasDone(page).fill("Reseated the display connector, flicker still there");
  await submit(page).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Arbeitsschritt zu „${title}“ eingetragen.`);
  await expect(page.getByRole("main")).toContainText(`E2E ${helper.username} · `);
});

test("no work is logged on a defect resolved meanwhile – the form says so and keeps what was typed", async ({
  page,
  browser,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await openLogWork(page, museumNumber, title);
  await whatWasDone(page).fill("Adjusted EOS switch");

  // Meanwhile on a second phone: the same technician resolves the defect.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await context.newPage();
  await logIn(other);
  await openDefect(other, museumNumber, title);
  await other.getByRole("main").getByRole("link", { name: "Beheben", exact: true }).click();
  await other.getByLabel("Abschlussnotiz").fill("Coil stop replaced");
  await other.getByRole("button", { name: "Als behoben eintragen" }).click();
  await expect(other.getByRole("main").getByRole("status")).toContainText("behoben");
  await context.close();

  await submit(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dieser Defekt ist nicht mehr offen.");
  await expect(whatWasDone(page)).toHaveValue("Adjusted EOS switch");
  // The resolved defect's page offers no logging of work, and its form page says why.
  await page.getByRole("main").getByRole("link", { name: "Zurück zum Defekt" }).click();
  await expect(page.getByRole("main").getByRole("link", { name: "Arbeitsschritt eintragen" })).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText("Noch kein Arbeitsschritt eingetragen.");
});

test("a claim made meanwhile asks to send again: the texts are kept, and sending again logs the work", async ({
  page,
  browser,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await openLogWork(page, museumNumber, title);
  await whatWasDone(page).fill("Adjusted EOS switch");
  await partsUsed(page).fill("none");

  // Meanwhile on a second phone: the same technician claims the defect.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await context.newPage();
  await logIn(other);
  await openDefect(other, museumNumber, title);
  await other.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(other.getByRole("main")).toContainText("Von dir übernommen");
  await context.close();

  await submit(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Jemand hat den Defekt inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal eintragen.",
  );
  await expect(whatWasDone(page)).toHaveValue("Adjusted EOS switch");
  await expect(partsUsed(page)).toHaveValue("none");
  await submit(page).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Arbeitsschritt zu „${title}“ eingetragen.`);
  await expect(page.getByRole("main")).toContainText("Adjusted EOS switch");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("work is logged, and a missing text is asked for", async ({ page }) => {
    await logIn(page);
    const { museumNumber, title } = await anOpenDefect(page);
    await openLogWork(page, museumNumber, title);

    await submit(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte kurz beschreiben, was gemacht wurde.");
    await whatWasDone(page).fill("Checked the coil");
    await partsUsed(page).fill("none");
    await submit(page).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`Arbeitsschritt zu „${title}“ eingetragen.`);
    await expect(page.getByRole("main")).toContainText("Checked the coil");
    await expect(page.getByRole("main")).toContainText("Verwendete Teile: none");
  });
});

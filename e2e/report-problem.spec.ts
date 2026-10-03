import type { Browser, Page } from "@playwright/test";
import { allowPreview, expect, openMore, test } from "./fixtures";

/**
 * A visitor reports a problem on a phone (ST-013): from the visitor machine page to the report form page
 * `/m/<museum number>/melden` and back, without login. The machine is registered through the team pages by the e2e
 * technician each local run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** A machine registered by the e2e technician, who logs out again – returns its museum number. */
async function aPlayableMachine(page: Page, machineStatus: "playable" | "not-on-display" = "playable"): Promise<string> {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
  const title = `Medieval Madness ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 2, row 3");
  await page.getByLabel("Status").selectOption(machineStatus);
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  return museumNumber;
}

/** A visitor's phone with the given browser language – a fresh context: no team session, no remembered switch. */
async function visitor(browser: Browser, locale: string, javaScriptEnabled = true) {
  const context = await browser.newContext({
    locale,
    javaScriptEnabled,
    viewport: { width: 360, height: 800 },
    isMobile: true,
  });
  const phone = await context.newPage();
  await allowPreview(phone, test.info().project.use.baseURL);
  await phone.goto("/");
  return phone;
}

/** From the visitor machine page to the report form, the way a visitor gets there. */
async function openReportForm(phone: Page, museumNumber: string, button = "Problem melden") {
  await phone.goto(`/m/${museumNumber}`);
  await phone.getByRole("link", { name: button }).click();
  await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}/melden$`));
}

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("ST-013: Visitor reports a problem", async ({ page, browser }) => {
  const museumNumber = await aPlayableMachine(page);

  // The stored problem report (description, reporter visitor, time) is checked at the command seam
  // (src/modules/repair/report-problem-command.integration.test.ts); here the visitor sees it arrive.
  for (const [locale, button, field, send, confirmation, count] of [
    [
      "de-DE",
      "Problem melden",
      "Was ist das Problem?",
      "Meldung senden",
      "Danke! Deine Meldung ist beim Team angekommen.",
      "1 Meldung wartet noch auf die Sichtung durch das Team.",
    ],
    [
      "en-GB",
      "Report a problem",
      "What is the problem?",
      "Send report",
      "Thank you! Your report has reached the team.",
      "2 reports are waiting to be checked by the team.",
    ],
  ]) {
    const phone = await visitor(browser, locale);
    await openReportForm(phone, museumNumber, button);
    await phone.getByLabel(field).fill("Ball stuck behind the left ramp");
    await phone.getByRole("button", { name: send }).click();

    await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}\\?`));
    await expect(phone.getByRole("main").getByRole("status")).toHaveText(confirmation);
    await expect(phone.getByRole("main")).toContainText(count);
    expect(await pageWidth(phone)).toBeLessThanOrEqual(360);
  }
});

test("the report form shows no internal ID – the server finds the machine by its museum number", async ({
  page,
  browser,
}) => {
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE");

  await openReportForm(phone, museumNumber);

  expect(await phone.content()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

test("a machine not on display is refused at the report form, with the reason in words", async ({ page, browser }) => {
  const museumNumber = await aPlayableMachine(page, "not-on-display");
  const phone = await visitor(browser, "de-DE");

  // Its visitor machine page offers no button (ST-010) – the report form is opened directly.
  await phone.goto(`/m/${museumNumber}/melden`);
  await phone.getByLabel("Was ist das Problem?").fill("Ball stuck");
  await phone.getByRole("button", { name: "Meldung senden" }).click();

  await expect(phone.getByRole("main").getByRole("alert")).toHaveText(
    "Dieses Gerät ist gerade nicht ausgestellt. Probleme kannst du nur für ausgestellte Geräte melden.",
  );
});

test("without JavaScript a rejected report names the reason and keeps the description", async ({ page, browser }) => {
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE", false);
  await openReportForm(phone, museumNumber);
  const overlong = `Ball stuck ${"x".repeat(2000)}`;

  await phone.getByLabel("Was ist das Problem?").fill(overlong);
  await phone.getByRole("button", { name: "Meldung senden" }).click();

  await expect(phone.getByRole("main").getByRole("alert")).toHaveText("Bitte kürzer: höchstens 2000 Zeichen.");
  await expect(phone.getByLabel("Was ist das Problem?")).toHaveValue(overlong);
  await expect(phone.getByLabel("Was ist das Problem?")).toHaveAttribute("aria-invalid", "true");
});

test("ST-013: Description is required", async ({ page, browser }) => {
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE");
  await openReportForm(phone, museumNumber);

  await phone.getByRole("button", { name: "Meldung senden" }).click();

  await expect(phone.getByRole("main").getByRole("alert")).toHaveText("Bitte beschreibe das Problem.");
  await expect(phone.getByLabel("Was ist das Problem?")).toHaveAttribute("aria-invalid", "true");
  expect(await pageWidth(phone)).toBeLessThanOrEqual(360);
});

test("ST-013: Overlong description", async ({ page, browser }) => {
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE");
  await openReportForm(phone, museumNumber);
  const overlong = `Ball stuck ${"x".repeat(2000)}`;

  await phone.getByLabel("Was ist das Problem?").fill(overlong);
  await phone.getByRole("button", { name: "Meldung senden" }).click();

  await expect(phone.getByRole("main").getByRole("alert")).toHaveText("Bitte kürzer: höchstens 2000 Zeichen.");
  await expect(phone.getByLabel("Was ist das Problem?")).toHaveValue(overlong);
  expect(await pageWidth(phone)).toBeLessThanOrEqual(360);
});

test("ST-013: No contact data is asked for", async ({ page, browser }) => {
  const museumNumber = await aPlayableMachine(page);

  for (const javaScriptEnabled of [true, false]) {
    const phone = await visitor(browser, "de-DE", javaScriptEnabled);
    await openReportForm(phone, museumNumber);

    // The only thing a visitor fills in is the description – no name, e-mail address or other contact field.
    const fields = phone.getByRole("main").locator("form").locator("input:not([type=hidden]), textarea, select");
    await expect(fields).toHaveCount(1);
    await expect(fields.first()).toHaveAttribute("name", "description");
    await phone.getByLabel("Was ist das Problem?").fill("Coin door jammed");
    await phone.getByRole("button", { name: "Meldung senden" }).click();
    await expect(phone.getByRole("main").getByRole("status")).toHaveText(
      "Danke! Deine Meldung ist beim Team angekommen.",
    );
  }
});

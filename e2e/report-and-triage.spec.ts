import type { Page } from "@playwright/test";
import { aHelper, aMachine, expect, logIn, pageWidth, test, unique } from "./fixtures";

/**
 * Reporting a problem and linking it or resolving it on the spot in the same step, on a phone (ST-052, G21a): a
 * technician chooses the triage outcome on „Sichten“, a helper reaches „Direkt behoben“ from „Schon selbst behoben?“ on
 * the plain report form (H2) – then the form page, and back on the machine record. Needs the e2e technician each local
 * run creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** From the machine record to the choice of the triage outcome, the way a team member starts reporting. */
async function startReporting(page: Page, museumNumber: string) {
  await page.goto(`/team/machines/${museumNumber}`);
  await page.getByRole("link", { name: "Problem melden" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Problem melden · ${museumNumber}`);
}

/** A form page of a triage outcome, opened the way a technician gets there: „Problem melden“ → „Sichten“ → the button. */
async function openOutcome(page: Page, museumNumber: string, outcome: string, heading: string) {
  await startReporting(page, museumNumber);
  await page.getByRole("link", { name: outcome }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${heading} · ${museumNumber}`);
}

const LINK = "Problem melden und mit Defekt verknüpfen";
const RESOLVE = "Problem melden und als direkt behoben eintragen";

/** The machine gets an open defect: reported and recorded by the technician in one step (ST-023). */
async function anOpenDefect(page: Page, museumNumber: string, title: string) {
  await openOutcome(page, museumNumber, "Defekt erfassen", "Problem melden und Defekt erfassen");
  await page.getByLabel("Beschreibung").fill(`${title} – first seen`);
  await page.getByLabel("Titel").fill(title);
  await page.getByRole("button", { name: "Melden und Defekt erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(title);
}

const sendLink = (page: Page) => page.getByRole("button", { name: "Melden und mit Defekt verknüpfen" });
const sendResolved = (page: Page) => page.getByRole("button", { name: "Melden und als direkt behoben eintragen" });

/** Nothing of the machine waits for triage – and its problem reports are nowhere else to be seen yet. */
async function expectNothingWaits(page: Page, museumNumber: string) {
  await page.goto("/team/triage");
  await expect(page.getByRole("main")).not.toContainText(museumNumber);
}

test("ST-052: Technicians are offered all three triage outcomes when reporting", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await anOpenDefect(page, museumNumber, "Left flipper weak");

  await startReporting(page, museumNumber);

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Sichten" })).toBeVisible();
  // Every link of the page, in its order: the three outcomes, then the way back.
  await expect(main.getByRole("link")).toHaveText([
    "Mit Defekt verknüpfen",
    "Defekt erfassen",
    "Direkt behoben",
    "Zurück zum Gerät",
  ]);
  await expect(main).not.toContainText("hat keine offenen Defekte");
  await expect(main.locator("input, select, textarea, button, form")).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-052: No open defect, nothing to link when reporting", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);

  await startReporting(page, museumNumber);

  const main = page.getByRole("main");
  await expect(main.getByRole("link")).toHaveText(["Defekt erfassen", "Direkt behoben", "Zurück zum Gerät"]);
  await expect(main).toContainText(`${museumNumber} hat keine offenen Defekte.`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("a technician who opens the link form for a machine without open defects is told so, without a form", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);

  await page.goto(`/team/machines/${museumNumber}/melden/mit-defekt-verknuepfen`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${LINK} · ${museumNumber}`);
  await expect(page.getByRole("main")).toContainText(`${museumNumber} hat keine offenen Defekte.`);
  await expect(page.getByRole("main").locator("form")).toHaveCount(0);
});

test("ST-052: Helpers are offered resolving on the spot when reporting", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await logIn(page, await aHelper(page));

  await startReporting(page, museumNumber);

  const main = page.getByRole("main");
  await expect(main).toContainText("Schon selbst behoben?");
  const offer = main.getByRole("link", { name: "Direkt behoben" });
  await expect(offer).toHaveAttribute("href", `/team/machines/${museumNumber}/melden/direkt-behoben`);
  // Before the description: above it on the page, and earlier in the document.
  const description = page.getByLabel("Beschreibung");
  expect((await offer.boundingBox())!.y).toBeLessThan((await description.boundingBox())!.y);
  expect(
    await offer.evaluate((link) => !!(link.compareDocumentPosition(document.getElementById("description")!) & 4)),
  ).toBe(true);
  // No other triage outcome is offered to a helper (G11).
  await expect(main.getByRole("heading", { name: "Sichten" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Defekt erfassen" })).toHaveCount(0);
  await expect(main.getByRole("link", { name: "Mit Defekt verknüpfen" })).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // The plain form still sends with a description only.
  await description.fill("Rubber on the left slingshot cracked");
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(main.getByRole("status")).toHaveText(
    `Meldung zu ${museumNumber} erfasst – sie wartet auf die Sichtung.`,
  );
});

test("a helper who opens the form for linking lands on the plain report form", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await anOpenDefect(page, museumNumber, "Left flipper weak");
  await logIn(page, await aHelper(page));

  await page.goto(`/team/machines/${museumNumber}/melden/mit-defekt-verknuepfen`);

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}/melden$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Problem melden · ${museumNumber}`);
  await expect(page.getByLabel("Beschreibung")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
});

test("ST-052: A rejected resolution on the spot keeps what was typed", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await logIn(page, await aHelper(page));
  await startReporting(page, museumNumber);
  await page.getByRole("link", { name: "Direkt behoben" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${RESOLVE} · ${museumNumber}`);

  await page.getByLabel("Beschreibung").fill("Ball stuck behind the left ramp");
  await sendResolved(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte kurz beschreiben, was gemacht wurde.");
  await expect(page.getByLabel("Was wurde gemacht?")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Beschreibung")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Beschreibung")).toHaveValue("Ball stuck behind the left ramp");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // Not stored: a helper's stored problem report without a triage outcome would wait for triage.
  await expectNothingWaits(page, museumNumber);
});

test("ST-052: A rejected link keeps what was typed", async ({ page }) => {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  const defectTitle = unique("Left flipper weak");
  await anOpenDefect(page, museumNumber, defectTitle);
  await openOutcome(page, museumNumber, "Mit Defekt verknüpfen", LINK);
  // The machine's open defects, each with its title and since when it is open; none is preselected (ST-022).
  await expect(page.getByRole("radio")).toHaveCount(1);
  await expect(page.getByRole("radio")).not.toBeChecked();
  await expect(page.getByRole("main").locator("label", { has: page.getByRole("radio") })).toHaveText(
    new RegExp(`^${defectTitle}\\s*offen seit \\d{2}\\.\\d{2}\\.\\d{4}, \\d{2}:\\d{2}$`),
  );

  await page.getByLabel("Beschreibung").fill("Left flipper weak again during test");
  await sendLink(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Defekt auswählen.");
  await expect(page.getByLabel("Beschreibung")).toHaveValue("Left flipper weak again during test");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${LINK} · ${museumNumber}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // Not stored: the defect's page shows no such problem report (the happy path below shows it there).
  await page.goto("/team/defects");
  await page.getByRole("link", { name: defectTitle }).click();
  await expect(page.getByRole("main")).toContainText(`${defectTitle} – first seen`);
  await expect(page.getByRole("main")).not.toContainText("Left flipper weak again during test");
});

test("ST-052: After resolving on the spot when reporting, back on the machine record", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page);
  await logIn(page, await aHelper(page));
  await startReporting(page, museumNumber);
  await page.getByRole("link", { name: "Direkt behoben" }).click();
  // The plain form has a description too – wait for the form page before typing.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${RESOLVE} · ${museumNumber}`);

  await page.getByLabel("Beschreibung").fill("Ball stuck behind the left ramp");
  await page.getByLabel("Was wurde gemacht?").fill("Ball freed");
  await sendResolved(page).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${museumNumber} · ${title}`);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Meldung zu ${museumNumber} als direkt behoben eingetragen.`,
  );
  await expect(page.getByRole("main")).not.toContainText("wartet auf die Sichtung");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expectNothingWaits(page, museumNumber);
});

test("ST-052: After linking when reporting, back on the machine record", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await aMachine(page);
  const defectTitle = unique("Left flipper weak");
  await anOpenDefect(page, museumNumber, defectTitle);
  await openOutcome(page, museumNumber, "Mit Defekt verknüpfen", LINK);

  await page.getByLabel("Beschreibung").fill("Left flipper weak again during test");
  await page.getByRole("radio").check();
  await sendLink(page).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${museumNumber} · ${title}`);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Meldung zu ${museumNumber} mit Defekt „${defectTitle}“ verknüpft.`,
  );
  await expect(page.getByRole("main")).not.toContainText("wartet auf die Sichtung");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await expectNothingWaits(page, museumNumber);
  // Linked: the defect's page shows the problem report.
  await page.goto("/team/defects");
  await page.getByRole("link", { name: defectTitle }).click();
  await expect(page.getByRole("main")).toContainText("Left flipper weak again during test");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a technician reports and resolves on the spot, then reports and links – rejected forms keep what was typed", async ({
    page,
  }) => {
    await logIn(page);
    const { museumNumber } = await aMachine(page);
    await anOpenDefect(page, museumNumber, "Left flipper weak");

    await openOutcome(page, museumNumber, "Direkt behoben", RESOLVE);
    await page.getByLabel("Beschreibung").fill("Ball stuck in the shooter lane");
    await sendResolved(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte kurz beschreiben, was gemacht wurde.");
    await expect(page.getByLabel("Beschreibung")).toHaveValue("Ball stuck in the shooter lane");
    await page.getByLabel("Was wurde gemacht?").fill("Freed the ball");
    await sendResolved(page).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      `Meldung zu ${museumNumber} als direkt behoben eingetragen.`,
    );

    await openOutcome(page, museumNumber, "Mit Defekt verknüpfen", LINK);
    await page.getByLabel("Beschreibung").fill("Left flipper weak again during test");
    await sendLink(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Defekt auswählen.");
    await expect(page.getByLabel("Beschreibung")).toHaveValue("Left flipper weak again during test");
    await page.getByRole("radio").check();
    await sendLink(page).click();
    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      `Meldung zu ${museumNumber} mit Defekt „Left flipper weak“ verknüpft.`,
    );
  });
});

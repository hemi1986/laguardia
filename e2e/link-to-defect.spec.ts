import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Linking a problem report to an open defect on a phone (ST-022): a technician goes from the triage list to the problem
 * report's page, to the form „Mit Defekt verknüpfen“ (G21) and back to the triage list. Needs the e2e technician each
 * local run creates (ST-083) – it sets up the machine, the open defect and the problem report; the preview database has
 * none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

function unique(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

async function report(page: Page, museumNumber: string, description: string) {
  await page.goto(`/team/machines/${museumNumber}/melden`);
  await page.getByLabel("Beschreibung").fill(description);
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(museumNumber);
}

/**
 * As the e2e technician: a machine with the open defect „Left flipper weak“ and an untriaged problem report beside it.
 * Returns the museum number, the machine model's title and the defect's title (unique per run).
 */
async function anOpenDefectAndAProblemReport(page: Page) {
  await logIn(page);
  const title = unique("Medieval Madness");
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 2");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];

  const defect = unique("Left flipper weak");
  await report(page, museumNumber, "Left flipper barely moves");
  await page.goto("/team/triage");
  await page.getByRole("link", { name: `${museumNumber} · ${title}` }).click();
  await page.getByRole("link", { name: "Defekt erfassen" }).click();
  await page.getByLabel("Titel").fill(defect);
  await page.getByRole("button", { name: "Defekt erfassen" }).click();
  await expect(page).toHaveURL(/\/team\/triage\?/);

  await report(page, museumNumber, "Flipper on the left does nothing");
  return { museumNumber, title, defect };
}

/** The form, opened the way a technician gets there: triage list → problem report → „Mit Defekt verknüpfen“. */
async function openLinkToDefect(page: Page, museumNumber: string, title: string) {
  await page.goto("/team/triage");
  await page.getByRole("link", { name: `${museumNumber} · ${title}` }).click();
  await page.getByRole("link", { name: "Mit Defekt verknüpfen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Mit Defekt verknüpfen · ${museumNumber}`);
}

const listed = (page: Page, museumNumber: string) =>
  page.getByRole("main").getByRole("article").filter({ hasText: museumNumber });

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("ST-022: A defect has to be chosen", async ({ page }) => {
  const { museumNumber, title, defect } = await anOpenDefectAndAProblemReport(page);
  await openLinkToDefect(page, museumNumber, title);
  // The open defect is offered, none preselected.
  await expect(page.getByRole("radio", { name: new RegExp(defect) })).not.toBeChecked();

  await page.getByRole("button", { name: "Mit Defekt verknüpfen" }).click();

  // The reason is shown at the form, which stays open.
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Defekt auswählen.");
  await expect(page).toHaveURL(/\/verknuepfen$/);
  await expect(page.getByRole("radio", { name: new RegExp(defect) })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // The problem report stays untriaged.
  await page.goto("/team/triage");
  await expect(listed(page, museumNumber)).toHaveCount(1);
});

test("ST-022: After linking, the technician is back on the triage list", async ({ page }) => {
  const { museumNumber, title, defect } = await anOpenDefectAndAProblemReport(page);
  await openLinkToDefect(page, museumNumber, title);
  await expect(page.getByText("Flipper on the left does nothing")).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.getByRole("radio", { name: new RegExp(defect) }).check();
  await page.getByRole("button", { name: "Mit Defekt verknüpfen" }).click();

  await expect(page).toHaveURL(/\/team\/triage\?/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sichtung");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Meldung zu ${museumNumber} mit Defekt „${defect}“ verknüpft.`,
  );
  await expect(listed(page, museumNumber)).toHaveCount(0);
  // The open defects list counts the linked problem report.
  await page.goto("/team/defects");
  await expect(page.getByRole("main").getByRole("article").filter({ hasText: defect })).toContainText(
    "1 verknüpfte Meldung",
  );
});

import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Dismissing a problem report on a phone (ST-020): a technician goes from the triage list to the problem report's page,
 * to the form „Meldung verwerfen“ (G21) and back to the triage list; spam asks once first (G10). Needs the e2e
 * technician each local run creates (ST-083) – the preview database has none before ST-068, so this runs locally only.
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

/** As the e2e technician: a machine and an untriaged problem report for it. Returns its museum number and model title. */
async function aProblemReport(page: Page, description = "Way too hard to score") {
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
  await page.goto(`/team/machines/${museumNumber}/melden`);
  await page.getByLabel("Beschreibung").fill(description);
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(museumNumber);
  return { museumNumber, title };
}

/** The form „Meldung verwerfen“, opened the way a technician gets there: triage list → problem report → the button. */
async function openDismiss(page: Page, museumNumber: string, title: string) {
  await page.goto("/team/triage");
  await page.getByRole("link", { name: `${museumNumber} · ${title}` }).click();
  await page.getByRole("link", { name: "Meldung verwerfen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Meldung verwerfen · ${museumNumber}`);
}

const reasonText = (page: Page) => page.getByLabel("Begründung (nur bei „Anderer Grund“)");
const submit = (page: Page) => page.getByRole("button", { name: "Meldung verwerfen" });
const listed = (page: Page, museumNumber: string) =>
  page.getByRole("main").getByRole("article").filter({ hasText: museumNumber });

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test('ST-020: "Machine retired" cannot be chosen by hand', async ({ page }) => {
  const { museumNumber, title } = await aProblemReport(page);
  await openDismiss(page, museumNumber, title);

  const reasons = page.getByRole("radio");
  await expect(reasons).toHaveCount(3);
  for (const [index, name] of ["Kein Defekt", "Spam", "Anderer Grund"].entries()) {
    await expect(reasons.nth(index)).toHaveAccessibleName(name);
    await expect(reasons.nth(index)).not.toBeChecked();
  }
  await expect(page.getByText("Gerät ausgemustert")).toHaveCount(0);
  await expect(reasonText(page)).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-020: Dismissing as spam asks first", async ({ page }) => {
  const { museumNumber, title } = await aProblemReport(page, "Cheap watches at example.com");
  await openDismiss(page, museumNumber, title);
  await page.getByRole("radio", { name: "Spam" }).check();

  await submit(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    `Meldung zu ${museumNumber} als Spam verwerfen? Beschreibung und Foto werden endgültig gelöscht.`,
  );
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  // Going back dismisses nothing, and spam is still chosen.
  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Spam" })).toBeChecked();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.goto("/team/triage");
  await expect(listed(page, museumNumber)).toHaveCount(1);

  // Asked once: confirming dismisses it as spam.
  await openDismiss(page, museumNumber, title);
  await page.getByRole("radio", { name: "Spam" }).check();
  await submit(page).click();
  await page.getByRole("button", { name: "Endgültig verwerfen" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Meldung zu ${museumNumber} verworfen.`);
  await expect(listed(page, museumNumber)).toHaveCount(0);
});

test("ST-020: A rejected dismissal keeps what was chosen", async ({ page }) => {
  const { museumNumber, title } = await aProblemReport(page);
  await openDismiss(page, museumNumber, title);
  await page.getByRole("radio", { name: "Anderer Grund" }).check();

  await submit(page).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte den Grund beschreiben.");
  await expect(reasonText(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("radio", { name: "Anderer Grund" })).toBeChecked();
  await expect(page).toHaveURL(/\/verwerfen$/);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await page.goto("/team/triage");
  await expect(listed(page, museumNumber)).toHaveCount(1);
});

test("ST-020: After dismissing, the technician is back on the triage list", async ({ page }) => {
  const { museumNumber, title } = await aProblemReport(page);
  await openDismiss(page, museumNumber, title);
  await page.getByRole("radio", { name: "Kein Defekt" }).check();

  await submit(page).click();

  await expect(page).toHaveURL(/\/team\/triage\?/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sichtung");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Meldung zu ${museumNumber} verworfen.`);
  await expect(listed(page, museumNumber)).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a missing reason is asked for, and spam is dismissed after the question", async ({ page }) => {
    const { museumNumber, title } = await aProblemReport(page, "Cheap watches at example.com");
    await openDismiss(page, museumNumber, title);

    await submit(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Grund auswählen.");
    await page.getByRole("radio", { name: "Spam" }).check();
    await submit(page).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("als Spam verwerfen?");
    await page.getByRole("button", { name: "Endgültig verwerfen" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`Meldung zu ${museumNumber} verworfen.`);
  });
});

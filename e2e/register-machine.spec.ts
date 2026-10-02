import type { Page } from "@playwright/test";
import { expect, openMore, test } from "./fixtures";

/**
 * Registering a machine on a phone (ST-007) and the Server Action runner in the browser (ST-073, proof moved here by
 * ST-078): a rejected registration shows the catalogue text of its error code, marks the field and keeps what was
 * typed – with and without JavaScript. Needs a technician account: locally the one from
 * `npm run setup:first-technician` (E2E_TEAM_USERNAME / E2E_TEAM_PASSWORD); the preview database has none before
 * ST-068 seeds it, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function logIn(page: Page, as = { username: username!, password: password! }) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(as.username);
  await page.getByLabel("Passwort").fill(as.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A machine model of this test's own, so the registration has one to choose. */
async function aMachineModel(page: Page): Promise<string> {
  const title = unique("Medieval Madness");
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Baujahr").fill("1997");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  return title;
}

/** From the team navigation to the registration form, the way a technician gets there. */
async function openRegistration(page: Page) {
  await page.goto("/team");
  await page.getByRole("navigation").getByRole("link", { name: "Geräte" }).click();
  await expect(page).toHaveURL(/\/team\/machines$/);
  await page.getByRole("link", { name: "Gerät erfassen" }).click();
  await expect(page).toHaveURL(/\/team\/machines\/new$/);
}

async function pageWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/** Fills the registration with a museum number in another format and submits it. */
async function registerWithMuseumNumber42(page: Page, model: string) {
  await page.getByLabel("Modell").selectOption({ label: `${model} (Williams, 1997)` });
  await page.getByLabel("Museumsnummer").fill("42");
  await page.getByLabel("Standort").fill("Hall 2, row 3");
  await page.getByLabel("Status").selectOption("limited");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
}

async function expectRejectedAndKept(page: Page, model: string) {
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte die Museumsnummer als „LG-“ mit drei Ziffern angeben, zum Beispiel LG-042 – oder das Feld leer lassen.",
  );
  await expect(page.getByLabel("Museumsnummer")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Standort")).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Museumsnummer")).toHaveValue("42");
  await expect(page.getByLabel("Modell").locator("option:checked")).toHaveText(`${model} (Williams, 1997)`);
  await expect(page.getByLabel("Standort")).toHaveValue("Hall 2, row 3");
  await expect(page.getByLabel("Status")).toHaveValue("limited");
}

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

test("ST-007: A rejected registration keeps what was typed", async ({ page }) => {
  await logIn(page);
  const model = await aMachineModel(page);
  await openRegistration(page);

  await registerWithMuseumNumber42(page, model);

  await expectRejectedAndKept(page, model);
  await expect(page).toHaveURL(/\/team\/machines\/new$/);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-007: After registering, the technician is back on the machine overview", async ({ page }) => {
  await logIn(page);
  const model = await aMachineModel(page);
  await openRegistration(page);

  await page.getByLabel("Modell").selectOption({ label: `${model} (Williams, 1997)` });
  await page.getByLabel("Standort").fill("Hall 2, row 3");
  await expect(page.getByLabel("Status")).toHaveValue("playable"); // preselected (user, 2026-10-01)
  await page.getByRole("button", { name: "Gerät erfassen" }).click();

  await expect(page).toHaveURL(/\/team\/machines\?registered=/);
  const confirmation = page.getByRole("main").getByRole("status");
  await expect(confirmation).toHaveText(new RegExp(`^Gerät LG-\\d{3} \\(${model}\\) erfasst\\.$`));
  const museumNumber = (await confirmation.textContent())!.match(/LG-\d{3}/)![0];
  const entry = page.getByRole("article").filter({ hasText: `${museumNumber} · ${model}` });
  await expect(entry).toContainText("Hall 2, row 3 · Status: Spielbereit");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-007: Helpers are not offered registering", async ({ page }) => {
  await logIn(page);
  const helper = { username: unique("helper").replace(" ", "_"), password: "e2e-secret-10" };
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${helper.username}`);
  await page.getByLabel("Benutzername").fill(helper.username);
  await page.getByLabel("Anfangspasswort").fill(helper.password);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();

  await logIn(page, helper);
  await page.getByRole("navigation").getByRole("link", { name: "Geräte" }).click();

  await expect(page.getByRole("heading", { name: "Geräte" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gerät erfassen" })).toHaveCount(0);
  await page.goto("/team/machines/new");
  await expect(page).toHaveURL(/\/team$/); // the registration page is not theirs either
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a rejected registration shows its catalogue text and keeps the input", async ({ page }) => {
    await logIn(page);
    const model = await aMachineModel(page);
    await openRegistration(page);

    await registerWithMuseumNumber42(page, model);

    await expectRejectedAndKept(page, model);
  });
});

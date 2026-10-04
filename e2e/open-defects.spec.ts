import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The open defects list and a defect's own page on a phone (ST-021), without JavaScript – the filter is a plain GET
 * form. Needs the e2e technician each local run creates (ST-083); the preview database has none before ST-068, so this
 * runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.use({ javaScriptEnabled: false });

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A machine with a problem report, recorded as a defect the way a technician does it. Returns the museum number. */
async function aRecordedDefect(page: Page, modelTitle: string, defectTitle: string) {
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(modelTitle);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: modelTitle, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${modelTitle} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 2");
  await page.getByLabel("Status").selectOption("playable");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  await page.goto(`/team/machines/${museumNumber}/melden`);
  await page.getByLabel("Beschreibung").fill("Left flipper barely moves");
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(museumNumber);
  await page.goto("/team/triage");
  await page.getByRole("link", { name: `${museumNumber} · ${modelTitle}` }).click();
  await page.getByRole("link", { name: "Defekt erfassen" }).click();
  await page.getByLabel("Titel").fill(defectTitle);
  await page.getByLabel("Priorität").selectOption("high");
  await page.getByLabel("Für Helfer:innen geeignet").check();
  await page.getByRole("button", { name: "Defekt erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(defectTitle);
  return museumNumber;
}

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("the open defects list on a phone: filtered by machine without JavaScript, then a defect opened", async ({
  page,
}) => {
  await logIn(page);
  const modelTitle = unique("Medieval Madness");
  const defectTitle = unique("Left flipper weak");
  const museumNumber = await aRecordedDefect(page, modelTitle, defectTitle);

  await page
    .getByRole("navigation", { name: "Navigation" })
    .getByRole("link", { name: "Defekte", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Defekte");
  await expect(page.getByRole("main")).toContainText(/\d+ Defekte? (ist|sind) offen\./);

  await page.getByLabel("Gerät").selectOption(museumNumber);
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(new RegExp(`machine=${museumNumber}`));
  await expect(page.getByLabel("Gerät")).toHaveValue(museumNumber); // the form keeps what is chosen
  const entries = page.getByRole("main").getByRole("listitem");
  await expect(entries).toHaveCount(1);
  await expect(entries).toContainText(`${museumNumber} · ${modelTitle}`);
  await expect(entries).toContainText("Priorität: hoch · Für Helfer:innen geeignet");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.getByRole("link", { name: defectTitle }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Defekt");
  await expect(page.getByRole("heading", { level: 2, name: defectTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: `${museumNumber} · ${modelTitle}` })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Ursprüngliche Meldung");
  await expect(page.getByRole("main")).toContainText("Left flipper barely moves");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.goto(`/team/machines?search=${museumNumber}`);
  await expect(page.getByRole("main")).toContainText("1 offener Defekt");
});

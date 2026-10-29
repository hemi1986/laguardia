import type { Page } from "@playwright/test";
import { expect, logIn, pageWidth, reportAsVisitor, test, unique, untickMaintenanceTasks } from "./fixtures";

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

/** A machine with a problem report, recorded as a defect the way a technician does it. Returns the museum number. */
async function aRecordedDefect(page: Page, modelTitle: string, defectTitle: string) {
  await page.goto("/team/machine-models/new");
  await page.getByLabel("Titel").fill(modelTitle);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: modelTitle, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${modelTitle} (Williams)` });
  await untickMaintenanceTasks(page);
  await page.getByLabel("Standort").fill("Hall 2");
  await page.getByLabel("Status").selectOption("playable");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  await reportAsVisitor(page, museumNumber, "Left flipper barely moves");
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

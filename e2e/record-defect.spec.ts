import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * Recording a defect on a phone (ST-018): from the triage list to the problem report's page, to the form „Defekt
 * erfassen“ (G21) and back to the triage list. Needs the e2e technician each local run creates (ST-083); the preview
 * database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

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

/**
 * A machine with the given status and a problem report for it, then the form „Defekt erfassen“ opened the way a
 * technician gets there: triage list → problem report → „Defekt erfassen“. Returns the museum number.
 */
async function openRecordDefect(page: Page, machineStatus: "playable" | "limited" | "out-of-order" = "playable") {
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
  await page.getByLabel("Status").selectOption(machineStatus);
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  await page.goto(`/team/machines/${museumNumber}/melden`);
  await page.getByLabel("Beschreibung").fill("Left flipper barely moves");
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(museumNumber); // stored before we go on
  await page.goto("/team/triage");
  await page.getByRole("link", { name: `${museumNumber} · ${title}` }).click();
  await page.getByRole("link", { name: "Defekt erfassen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Defekt erfassen · ${museumNumber}`);
  return museumNumber;
}

const status = (page: Page) => page.getByLabel("Status", { exact: true });

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("ST-018: Only Limited or Out of order in the same step", async ({ page }) => {
  await logIn(page);
  await openRecordDefect(page, "playable");

  await expect(status(page).locator("option")).toHaveText(["Status nicht ändern", "Eingeschränkt", "Außer Betrieb"]);
  await expect(status(page)).toHaveValue("");
  // The status history's reason is the defect's title – the form asks for none (ST-018 scenario 3).
  await expect(page.getByLabel("Grund")).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-018: The machine's current status is shown when recording a defect", async ({ page }) => {
  await logIn(page);
  const museumNumber = await openRecordDefect(page, "limited");

  await expect(page.getByRole("main")).toContainText(`${museumNumber} ist zurzeit Eingeschränkt.`);
  await expect(status(page).locator("option")).toHaveText(["Status nicht ändern", "Außer Betrieb"]);
});

test("ST-018: No stricter status, no status choice", async ({ page }) => {
  await logIn(page);
  const museumNumber = await openRecordDefect(page, "out-of-order");

  await expect(status(page)).toHaveCount(0);
  await expect(page.getByRole("main")).toContainText(`${museumNumber} ist schon Außer Betrieb – der Status bleibt.`);
});

test("ST-018: A rejected defect keeps what was typed", async ({ page }) => {
  await logIn(page);
  await openRecordDefect(page, "playable");

  await page.getByLabel("Priorität").selectOption("high");
  await page.getByLabel("Für Helfer:innen geeignet").check();
  await status(page).selectOption("out-of-order");
  await page.getByRole("button", { name: "Defekt erfassen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Titel angeben.");
  await expect(page.getByLabel("Titel")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Priorität")).toHaveValue("high");
  await expect(page.getByLabel("Für Helfer:innen geeignet")).toBeChecked();
  await expect(status(page)).toHaveValue("out-of-order");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-018: After recording, the technician is back on the triage list", async ({ page }) => {
  await logIn(page);
  const museumNumber = await openRecordDefect(page, "playable");

  await page.getByLabel("Titel").fill("Left flipper weak");
  await status(page).selectOption("out-of-order");
  await page.getByRole("button", { name: "Defekt erfassen" }).click();

  await expect(page).toHaveURL(/\/team\/triage\?/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Defekt „Left flipper weak“ an ${museumNumber} erfasst. ${museumNumber} ist jetzt Außer Betrieb.`,
  );
  await expect(page.getByRole("main").getByRole("article").filter({ hasText: museumNumber })).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a defect is recorded and a rejected one keeps what was chosen", async ({ page }) => {
    await logIn(page);
    const museumNumber = await openRecordDefect(page, "playable");

    await page.getByLabel("Priorität").selectOption("low");
    await page.getByRole("button", { name: "Defekt erfassen" }).click();
    await expect(page.getByLabel("Priorität")).toHaveValue("low");
    await page.getByLabel("Titel").fill("Rubber cracked");
    await page.getByRole("button", { name: "Defekt erfassen" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      `Defekt „Rubber cracked“ an ${museumNumber} erfasst.`,
    );
  });
});

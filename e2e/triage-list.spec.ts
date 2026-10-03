import type { Page } from "@playwright/test";
import { expect, openMore, test } from "./fixtures";

/**
 * The triage list on a phone (ST-017). The login check needs no account and runs against the preview too; the others
 * need the e2e technician each local run creates (ST-083) – the preview database has none before ST-068.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;
const needsTeam = () => test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");

function unique(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function logIn(page: Page, as = { username: username!, password: password! }) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(as.username);
  await page.getByLabel("Passwort").fill(as.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A machine and a problem report for it, both through the pages; the e2e technician stays logged in. */
async function aProblemReport(page: Page, description: string): Promise<string> {
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
  return museumNumber;
}

test("ST-017: Visitors cannot open the triage list", async ({ page }) => {
  await page.goto("/team/triage");

  await expect(page).toHaveURL(/\/login$/);
});

test("ST-017: Helpers see the triage list without technician actions", async ({ page }) => {
  needsTeam();
  await logIn(page);
  const description = unique("Ball stuck");
  await aProblemReport(page, description);
  const helper = { username: unique("helper"), password: "e2e-secret-10" };
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${helper.username}`);
  await page.getByLabel("Benutzername").fill(helper.username);
  await page.getByLabel("Anfangspasswort").fill(helper.password);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  await logIn(page, helper);

  await page.getByRole("navigation").getByRole("link", { name: "Sichtung" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sichtung");
  await expect(page.getByRole("main")).toContainText(description);
  for (const action of ["Defekt erfassen", "Verknüpfen", "Verwerfen"]) {
    await expect(page.getByRole("main").getByRole("button", { name: action })).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("link", { name: action })).toHaveCount(0);
  }
});

test("a technician opens a problem report from the triage list on a phone", async ({ page }) => {
  needsTeam();
  await logIn(page);
  const description = unique("Rubber cracked");
  const museumNumber = await aProblemReport(page, description);

  await page.getByRole("navigation").getByRole("link", { name: "Sichtung" }).click();
  const entry = page.getByRole("article").filter({ hasText: description });
  await expect(entry).toContainText("wartet seit weniger als 1 Stunde");
  await entry.getByRole("link", { name: new RegExp(`^${museumNumber} · `) }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Meldung");
  await expect(page.getByRole("main")).toContainText(description);
  await expect(page.getByRole("main")).toContainText(museumNumber);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

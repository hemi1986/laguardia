import type { Browser, Page } from "@playwright/test";
import { expect, openMore, test } from "./fixtures";

/**
 * Resolving a problem on the spot on a phone (ST-019): a helper goes from the triage list to the problem report's page,
 * to the form „Direkt behoben“ (G21) and back to the triage list. Needs the e2e technician each local run creates
 * (ST-083) – it sets up the machine and the helper's account; the preview database has none before ST-068, so this runs
 * locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

type Account = { username: string; password: string };
const technician = (): Account => ({ username: username!, password: password! });

function unique(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function logIn(page: Page, as: Account) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(as.username);
  await page.getByLabel("Passwort").fill(as.password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

async function logOut(page: Page) {
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
}

/**
 * As the e2e technician: a machine, a problem report for it and a helper account. Logs out afterwards and returns the
 * museum number, the machine model's title and the helper.
 */
async function aProblemReportAndAHelper(page: Page) {
  await logIn(page, technician());
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
  await page.getByLabel("Beschreibung").fill("Ball stuck behind the left ramp");
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(museumNumber);
  const helper = { username: unique("anna"), password: "e2e-secret-10" };
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(`Anna ${helper.username}`);
  await page.getByLabel("Benutzername").fill(helper.username);
  await page.getByLabel("Anfangspasswort").fill(helper.password);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  await logOut(page);
  return { museumNumber, title, helper };
}

/** The form „Direkt behoben“, opened the way a team member gets there: triage list → problem report → „Direkt behoben“. */
async function openResolveOnTheSpot(page: Page, museumNumber: string, title: string) {
  await page.goto("/team/triage");
  await page.getByRole("link", { name: `${museumNumber} · ${title}` }).click();
  await page.getByRole("link", { name: "Direkt behoben" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Direkt behoben · ${museumNumber}`);
}

/** A second phone: the e2e technician records a defect from the same problem report – it is triaged now. */
async function technicianTriagesMeanwhile(browser: Browser, museumNumber: string, title: string) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await context.newPage();
  await logIn(other, technician());
  await other.goto("/team/triage");
  await other.getByRole("link", { name: `${museumNumber} · ${title}` }).click();
  await other.getByRole("link", { name: "Defekt erfassen" }).click();
  await other.getByLabel("Titel").fill("Left ramp catches balls");
  await other.getByRole("button", { name: "Defekt erfassen" }).click();
  await expect(other).toHaveURL(/\/team\/triage\?/);
  await context.close();
}

const note = (page: Page) => page.getByLabel("Was wurde gemacht?");
const listed = (page: Page, museumNumber: string) =>
  page.getByRole("main").getByRole("article").filter({ hasText: museumNumber });

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("ST-019: A note is required", async ({ page }) => {
  const { museumNumber, title, helper } = await aProblemReportAndAHelper(page);
  await logIn(page, helper);
  await openResolveOnTheSpot(page, museumNumber, title);

  await page.getByRole("button", { name: "Als direkt behoben eintragen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte kurz beschreiben, was gemacht wurde.");
  await expect(note(page)).toHaveAttribute("aria-invalid", "true");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await page.goto("/team/triage");
  await expect(listed(page, museumNumber)).toHaveCount(1);
});

test("ST-019: A rejected resolution keeps what was typed", async ({ page, browser }) => {
  const { museumNumber, title, helper } = await aProblemReportAndAHelper(page);
  await logIn(page, helper);
  await openResolveOnTheSpot(page, museumNumber, title);
  await note(page).fill("Ball freed, ramp OK");

  await technicianTriagesMeanwhile(browser, museumNumber, title);
  await page.getByRole("button", { name: "Als direkt behoben eintragen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/ hat diese Meldung schon gesichtet\.$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Direkt behoben · ${museumNumber}`);
  await expect(note(page)).toHaveValue("Ball freed, ramp OK");
  await expect(page.getByRole("main").getByRole("link", { name: "Zurück zur Sichtung" })).toBeVisible();
});

test("ST-019: After resolving, the team member is back on the triage list", async ({ page }) => {
  const { museumNumber, title, helper } = await aProblemReportAndAHelper(page);
  await logIn(page, helper);
  await openResolveOnTheSpot(page, museumNumber, title);

  await note(page).fill("Ball freed, ramp OK");
  await page.getByRole("button", { name: "Als direkt behoben eintragen" }).click();

  await expect(page).toHaveURL(/\/team\/triage\?/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sichtung");
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Meldung zu ${museumNumber} als direkt behoben eingetragen.`,
  );
  await expect(listed(page, museumNumber)).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a problem is resolved on the spot, and a rejected note is asked for again", async ({ page }) => {
    const { museumNumber, title, helper } = await aProblemReportAndAHelper(page);
    await logIn(page, helper);
    await openResolveOnTheSpot(page, museumNumber, title);

    await page.getByRole("button", { name: "Als direkt behoben eintragen" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte kurz beschreiben, was gemacht wurde.");
    await note(page).fill("Ball freed");
    await page.getByRole("button", { name: "Als direkt behoben eintragen" }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      `Meldung zu ${museumNumber} als direkt behoben eingetragen.`,
    );
  });
});

import type { Page } from "@playwright/test";
import { expect, openMore, test } from "./fixtures";

/**
 * Claiming a defect on a phone (ST-025): open defects list → the defect's page → „Übernehmen“ (or „Von … übernehmen“) →
 * the confirmation, the claimant on the page and in the list, and the filter „Nur von mir übernommene“. Needs the e2e
 * technician each local run creates (ST-083, named „E2E Technician“); the preview database has none before ST-068, so
 * this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

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

/** A playable machine, registered by the e2e technician. Returns its museum number and model title. */
async function aMachine(page: Page) {
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
  return { museumNumber, title };
}

/** A helper account created by the e2e technician, who then logs out. */
async function aHelper(page: Page) {
  const helper = { username: unique("helper").replace(" ", "_"), password: "e2e-secret-10" };
  await page.goto("/team/members");
  await page.getByLabel("Name", { exact: true }).fill(`E2E ${helper.username}`);
  await page.getByLabel("Benutzername").fill(helper.username);
  await page.getByLabel("Anfangspasswort").fill(helper.password);
  await page.getByRole("button", { name: "Konto anlegen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("Konto angelegt.");
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  return helper;
}

const TECHNICIAN = "E2E Technician";

/** A machine with an open defect, reported and recorded by the e2e technician in one step (ST-023). */
async function anOpenDefect(page: Page, { suitableForHelpers = false } = {}) {
  const { museumNumber } = await aMachine(page);
  const title = unique("Left flipper weak");
  await page.goto(`/team/machines/${museumNumber}/melden/defekt-erfassen`);
  await page.getByLabel("Beschreibung").fill(`${title} – first seen`);
  await page.getByLabel("Titel").fill(title);
  if (suitableForHelpers) await page.getByLabel("Für Helfer:innen geeignet").check();
  await page.getByRole("button", { name: "Melden und Defekt erfassen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(title);
  return { museumNumber, title };
}

/** The defect's page, opened the way a team member gets there: the open defects list, narrowed to the machine. */
async function openDefect(page: Page, museumNumber: string, title: string) {
  await page.goto(`/team/defects?machine=${museumNumber}`);
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
}

/** The machine's entry in the open defects list. */
async function listEntry(page: Page, museumNumber: string) {
  await page.goto(`/team/defects?machine=${museumNumber}`);
  const entries = page.getByRole("main").getByRole("listitem");
  await expect(entries).toHaveCount(1);
  return entries;
}

async function pageWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("ST-025: Team member claims an unclaimed defect", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  await expect(await listEntry(page, museumNumber)).not.toContainText("bernommen");
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main).not.toContainText("bernommen von");

  await main.getByRole("button", { name: "Übernehmen", exact: true }).click();

  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ übernommen.`);
  await expect(main).toContainText("Von dir übernommen");
  // One's own claim is not offered again.
  await expect(main.getByRole("button", { name: /bernehmen/ })).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  // The open defects list shows the claimant – to themselves, and by name to everyone else.
  await expect(await listEntry(page, museumNumber)).toContainText("Von dir übernommen");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  await logIn(page, await aHelper(page));
  await expect(await listEntry(page, museumNumber)).toContainText(`Übernommen von ${TECHNICIAN}`);
});

test("a helper takes a defect over from its claimant and finds it with the filter for their own claims", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  await openDefect(page, museumNumber, title);
  await page.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toBeVisible();
  await logIn(page, await aHelper(page));
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main).toContainText(`Übernommen von ${TECHNICIAN}`);

  // No question first: a claim is only a signal (ST-025, decision 2a).
  await main.getByRole("button", { name: `Von ${TECHNICIAN} übernehmen` }).click();

  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ übernommen. Vorher: ${TECHNICIAN}.`);
  await expect(main).toContainText("Von dir übernommen");
  await expect(main).not.toContainText(`Übernommen von ${TECHNICIAN}`);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.goto("/team/defects");
  await page.getByLabel("Nur von mir übernommene").check();
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(/mine=1/);
  await expect(page.getByLabel("Nur von mir übernommene")).toBeChecked();
  const entries = main.getByRole("listitem");
  await expect(entries).toHaveCount(1);
  await expect(entries).toContainText(title);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("a helper is not offered a defect that is not suitable for helpers, and one without a claim says so in the filter", async ({
  page,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await logIn(page, await aHelper(page));

  await openDefect(page, museumNumber, title);

  await expect(page.getByRole("main")).toContainText("Nicht für Helfer:innen geeignet");
  await expect(page.getByRole("main").getByRole("button", { name: /bernehmen/ })).toHaveCount(0);
  await page.goto("/team/defects?mine=1");
  await expect(page.getByRole("main")).toContainText("Du hast keinen offenen Defekt übernommen.");
});

test("a claim made meanwhile is answered with a conflict, not a silent takeover – then the page offers taking over", async ({
  page,
  browser,
}) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page, { suitableForHelpers: true });
  const helper = await aHelper(page);
  await logIn(page);
  await openDefect(page, museumNumber, title);
  const main = page.getByRole("main");
  await expect(main.getByRole("button", { name: "Übernehmen", exact: true })).toBeVisible();

  // Meanwhile on a second phone: the helper claims the same defect.
  const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const other = await context.newPage();
  await logIn(other, helper);
  await openDefect(other, museumNumber, title);
  await other.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();
  await expect(other.getByRole("main").getByRole("status")).toHaveText(`Du hast „${title}“ übernommen.`);
  await context.close();

  await main.getByRole("button", { name: "Übernehmen", exact: true }).click();

  await expect(main.getByRole("alert")).toHaveText(
    "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
  );
  await expect(main.getByRole("status")).toHaveCount(0);
  // The page shows the defect as it is now: claimed by the helper, who can be taken over from – knowingly.
  await expect(main).toContainText(`Übernommen von E2E ${helper.username}`);
  await main.getByRole("button", { name: `Von E2E ${helper.username} übernehmen` }).click();
  await expect(main.getByRole("status")).toHaveText(`Du hast „${title}“ übernommen. Vorher: E2E ${helper.username}.`);
  // The rejection of the first try is gone with it.
  await expect(main.getByRole("alert")).toHaveCount(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a defect is claimed", async ({ page }) => {
    await logIn(page);
    const { museumNumber, title } = await anOpenDefect(page);
    await openDefect(page, museumNumber, title);

    await page.getByRole("main").getByRole("button", { name: "Übernehmen", exact: true }).click();

    await expect(page.getByRole("main").getByRole("status")).toHaveText(`Du hast „${title}“ übernommen.`);
    await expect(page.getByRole("main")).toContainText("Von dir übernommen");
  });
});

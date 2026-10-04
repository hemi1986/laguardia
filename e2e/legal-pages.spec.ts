import type { Browser, Page } from "@playwright/test";
import { allowPreview, expect, openMore, test } from "./fixtures";

/**
 * The legal pages of the visitor pages on a phone (ST-064): the privacy notice at /datenschutz and – only if the museum
 * provides one – the imprint at /impressum, in the visitor's language, linked from every visitor page. The machines
 * are registered through the team pages by the e2e technician each local run creates (ST-083); the preview database
 * has none before ST-068, so the tests that need a machine run locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;
const needsMachines = () =>
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");

/** A playable machine registered by the e2e technician, who logs out again – returns its museum number. */
async function aPlayableMachine(page: Page): Promise<string> {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
  const title = `Medieval Madness ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Hall 2, row 3");
  await page.getByLabel("Status").selectOption("playable");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  return museumNumber;
}

/** A visitor's phone with the given browser language – a fresh context: no team session, no remembered switch. */
async function visitor(browser: Browser, locale: string) {
  const context = await browser.newContext({ locale, viewport: { width: 360, height: 800 }, isMobile: true });
  const phone = await context.newPage();
  await allowPreview(phone, test.info().project.use.baseURL);
  await phone.goto("/");
  return phone;
}

test("ST-064: Visitor opens the privacy notice", async ({ page, browser }) => {
  needsMachines();
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE");

  await phone.goto(`/m/${museumNumber}`);
  await phone.getByRole("link", { name: "Datenschutz" }).click();

  await expect(phone).toHaveURL(/\/datenschutz$/);
  const german = phone.locator('[lang="de"]');
  await expect(german.getByRole("heading", { level: 1, name: "Datenschutzhinweis" })).toBeVisible();
  await expect(phone.getByText("Wir erheben keine Kontaktdaten", { exact: false })).toBeVisible();
});

test("ST-064: Legal pages in English", async ({ browser }) => {
  const phone = await visitor(browser, "de-DE");
  await phone.getByRole("button", { name: "English" }).click();
  const english = phone.locator('[lang="en"]');

  await english.getByRole("link", { name: "Privacy" }).click();
  await expect(phone).toHaveURL(/\/datenschutz$/);
  await expect(english.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeVisible();
  await expect(english.getByText("We collect no contact data", { exact: false })).toBeVisible();

  // The imprint is offered only once the museum provides one (ST-064) – then it is in English too.
  const imprint = english.getByRole("link", { name: "Imprint" });
  if ((await imprint.count()) > 0) {
    await imprint.click();
    await expect(phone).toHaveURL(/\/impressum$/);
    await expect(english.getByRole("heading", { level: 1 })).not.toHaveText("Impressum");
  }
});

test("ST-064: Legal pages are reachable from every visitor page", async ({ page, browser }) => {
  needsMachines();
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE");

  /** The legal links at the end of a visitor page – the privacy notice, and the imprint if the museum provides one. */
  async function expectLegalLinks() {
    const legal = phone.getByRole("navigation", { name: "Rechtliches" });
    await expect(legal.getByRole("link", { name: "Datenschutz" })).toHaveAttribute("href", "/datenschutz");
    const imprint = legal.getByRole("link", { name: "Impressum" });
    if ((await imprint.count()) > 0) await expect(imprint).toHaveAttribute("href", "/impressum");
  }

  await phone.goto(`/m/${museumNumber}`);
  await expectLegalLinks();

  await phone.getByRole("link", { name: "Problem melden" }).click();
  await expect(phone).toHaveURL(new RegExp(`/m/${museumNumber}/melden$`));
  await expectLegalLinks();

  await phone.getByLabel("Was ist das Problem?").fill(`Kugel hängt ${Date.now().toString(36)}`);
  await phone.getByRole("button", { name: "Meldung senden" }).click();
  await expect(phone.getByText("Danke! Deine Meldung ist beim Team angekommen.")).toBeVisible();
  await expectLegalLinks();
});

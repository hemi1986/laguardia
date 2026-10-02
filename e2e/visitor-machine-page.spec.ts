import type { Browser, Page } from "@playwright/test";
import { allowPreview, expect, openMore, test } from "./fixtures";

/**
 * The visitor machine page on a phone (ST-010), at the QR address /m/<museum number>, without login. The machines are
 * registered through the team pages by the e2e technician each local run creates (ST-083); the preview database has
 * none before ST-068, so only the unknown museum number runs there.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;
const needsMachines = () => test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** A machine of the machine model "Medieval Madness …" (Williams, 1997), registered by the e2e technician. */
async function aRegisteredMachine(page: Page, machineStatus: "playable" | "not-on-display" = "playable") {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
  const title = `Medieval Madness ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Baujahr").fill("1997");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams, 1997)` });
  await page.getByLabel("Standort").fill("Hall 2, row 3");
  await page.getByLabel("Status").selectOption(machineStatus);
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  const museumNumber = (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
  await openMore(page);
  await page.getByRole("button", { name: "Abmelden" }).click();
  return { title, museumNumber };
}

/**
 * A visitor's phone with the given browser language – a fresh context, so no team session and no remembered switch.
 * It gets the preview's protection bypass like the test's own page, and opens the start page once: on the preview the
 * first navigation of a context sets Vercel's bypass cookie (engineering conventions, Tests).
 */
async function visitor(browser: Browser, locale: string) {
  const context = await browser.newContext({ locale, viewport: { width: 360, height: 800 }, isMobile: true });
  const phone = await context.newPage();
  await allowPreview(phone, test.info().project.use.baseURL);
  await phone.goto("/");
  return phone;
}

test("ST-010: Visitor with a German browser opens the page", async ({ page, browser }) => {
  needsMachines();
  const { title, museumNumber } = await aRegisteredMachine(page);
  const phone = await visitor(browser, "de-DE");

  await phone.goto(`/m/${museumNumber}`);

  await expect(phone.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(phone.getByRole("main")).toContainText("Williams · 1997");
  await expect(phone.getByRole("main")).toContainText("Status: Spielbereit");
  await expect(phone.getByRole("link", { name: "Problem melden" })).toHaveAttribute("href", `/m/${museumNumber}/melden`);
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("ST-010: Visitor with an English browser opens the page", async ({ page, browser }) => {
  needsMachines();
  const { museumNumber } = await aRegisteredMachine(page);
  const phone = await visitor(browser, "en-GB");

  await phone.goto(`/m/${museumNumber}`);

  await expect(phone.getByRole("main")).toContainText("Status: Playable");
  await expect(phone.getByRole("link", { name: "Report a problem" })).toBeVisible();
});

test("ST-010: Other browser languages get English", async ({ page, browser }) => {
  needsMachines();
  const { museumNumber } = await aRegisteredMachine(page);
  const phone = await visitor(browser, "fr-FR");

  await phone.goto(`/m/${museumNumber}`);

  await expect(phone.getByRole("main")).toContainText("Status: Playable");
  await expect(phone.getByRole("link", { name: "Report a problem" })).toBeVisible();
});

test("ST-010: Visitor switches the language", async ({ page, browser }) => {
  needsMachines();
  const first = await aRegisteredMachine(page);
  const second = await aRegisteredMachine(page);
  const phone = await visitor(browser, "de-DE");
  await phone.goto(`/m/${first.museumNumber}`);
  await expect(phone.getByRole("main")).toContainText("Status: Spielbereit");

  await phone.getByRole("button", { name: "English" }).click();

  await expect(phone).toHaveURL(new RegExp(`/m/${first.museumNumber}$`));
  await expect(phone.getByRole("main")).toContainText("Status: Playable");
  await phone.goto(`/m/${second.museumNumber}`);
  await expect(phone.getByRole("main")).toContainText("Status: Playable");
  await expect(phone.getByRole("button", { name: "Deutsch" })).toBeVisible();
});

test("ST-010: Machine not on display", async ({ page, browser }) => {
  needsMachines();
  const { museumNumber } = await aRegisteredMachine(page, "not-on-display");
  const phone = await visitor(browser, "de-DE");

  await phone.goto(`/m/${museumNumber}`);

  await expect(phone.getByRole("main")).toContainText(
    "Dieses Gerät ist gerade nicht ausgestellt. Probleme kannst du nur für ausgestellte Geräte melden.",
  );
  await expect(phone.getByRole("link", { name: "Problem melden" })).toHaveCount(0);
});

test("the QR address is never served from a shared cache", async ({ browser }) => {
  // `next dev` sends its own "no-cache, must-revalidate" for every page, so only a production build shows the real
  // header – this runs against the preview in CI (the e2e-preview workflow). The rule covers every /m/ address.
  test.skip(!process.env.BASE_URL, "the dev server overrides Cache-Control – checked against the preview");
  const phone = await visitor(browser, "de-DE");

  const response = await phone.goto("/m/LG-999");

  expect(response!.headers()["cache-control"]).toMatch(/private/);
  expect(response!.headers()["cache-control"]).toMatch(/no-store/);
  expect(response!.headers()["cache-control"]).not.toMatch(/public|s-maxage/);
});

test("ST-010: No internal data in the page source", async ({ page, browser }) => {
  needsMachines();
  const { museumNumber } = await aRegisteredMachine(page);
  const phone = await visitor(browser, "de-DE");
  await phone.goto(`/m/${museumNumber}`);

  const source = await (await phone.request.get(`/m/${museumNumber}`)).text();

  expect(source).toContain("Williams");
  expect(source).not.toContain("E2E Technician");
  expect(source).not.toContain("Hall 2, row 3");
  expect(source).not.toMatch(UUID);
});

test("ST-010: Unknown museum number", async ({ browser }) => {
  const phone = await visitor(browser, "de-DE");

  const response = await phone.goto("/m/LG-999");

  expect(response!.status()).toBe(404);
  await expect(phone.getByRole("main")).toContainText("Kein Gerät mit dieser Museumsnummer.");
  const english = await visitor(browser, "en-US");
  await english.goto("/m/LG-999");
  await expect(english.getByRole("main")).toContainText("There is no machine with this museum number.");
});

test("a malformed address is refused by Next.js itself, not a server error", async ({ browser }) => {
  const phone = await visitor(browser, "de-DE");

  const response = await phone.goto("/m/%E0%A4%A");

  expect(response!.status()).toBe(400);
});

test("the unknown-number page offers the language switch and a way on", async ({ browser }) => {
  const phone = await visitor(browser, "de-DE");

  await phone.goto("/m/LG-999");

  await expect(phone.getByRole("button", { name: "English" })).toBeVisible();
  await phone.getByRole("link", { name: "Zur Startseite" }).click();
  await expect(phone).toHaveURL(/\/$/);
});

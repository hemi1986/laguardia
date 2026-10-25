import type { Browser, Page } from "@playwright/test";
import { aHelper, allowPreview, aTeamMember, expect, logIn, openMore, pageWidth, test, type Account } from "./fixtures";

/**
 * The team members page and one team member's page (ST-081), at 360 px: acting on one account, asking once before
 * deactivating it, and activating it again. A team member's own phone is a browser context of its own.
 */

/** A phone of its own, logged in as `account` – the team member whose session the scenario watches. */
async function aPhoneLoggedInAs(browser: Browser, account: Account): Promise<Page> {
  const context = await browser.newContext({ locale: "de-DE", viewport: { width: 360, height: 800 }, isMobile: true });
  const phone = await context.newPage();
  await allowPreview(phone, test.info().project.use.baseURL);
  await logIn(phone, account);
  return phone;
}

/** Whether `account` can log in with its password – on a fresh phone, closed again. */
async function canLogIn(browser: Browser, account: Account): Promise<boolean> {
  const context = await browser.newContext({ locale: "de-DE", viewport: { width: 360, height: 800 } });
  const phone = await context.newPage();
  await allowPreview(phone, test.info().project.use.baseURL);
  await phone.goto("/login");
  await phone.getByLabel("Benutzername").fill(account.username);
  await phone.getByLabel("Passwort").fill(account.password);
  await phone.getByRole("button", { name: "Anmelden" }).click();
  // Either the team start page or the login's rejection – the login page itself is where it starts.
  await Promise.race([phone.waitForURL(/\/team$/), phone.getByRole("main").getByRole("alert").waitFor()]);
  const loggedIn = new URL(phone.url()).pathname === "/team";
  await context.close();
  return loggedIn;
}

/** Whether the session on `phone` still works – a team page opens instead of the login. */
async function stillLoggedIn(phone: Page): Promise<boolean> {
  await phone.goto("/team");
  return new URL(phone.url()).pathname === "/team";
}

/** The team member's own page, opened from the list – with the filter for deactivated accounts when asked. */
async function openFromTheList(page: Page, name: string, { deactivated = false } = {}) {
  await page.goto("/team/members");
  if (deactivated) {
    await page.getByLabel("Auch deaktivierte Konten anzeigen").check();
    await page.getByRole("button", { name: "Anzeigen" }).click();
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  }
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

function firstNameOf(name: string): string {
  return name.split(" ")[0];
}

async function deactivate(page: Page, name: string) {
  await openFromTheList(page, name);
  await page.getByRole("link", { name: "Konto deaktivieren" }).click();
  await page.getByRole("button", { name: "Konto deaktivieren" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${name} deaktiviert.`);
}

test.beforeEach(async ({ page }) => {
  await logIn(page);
});

test("ST-081: A technician changes the role from the account page", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openFromTheList(page, anna.name);

  await page.getByRole("button", { name: "Zu Techniker:in machen" }).click();

  await expect(page).toHaveURL(/\/team\/members\/[0-9a-f-]+\?done=role$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Rolle von ${anna.name} geändert.`);
  await expect(page.getByRole("main")).toContainText("Techniker:in");
  await expect(page.getByRole("button", { name: "Zu Helfer:in machen" })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-081: A technician resets a password from the account page", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openFromTheList(page, anna.name);

  await page.getByLabel("Neues Passwort").fill("anna-new-pw1");
  await page.getByRole("button", { name: "Passwort zurücksetzen" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Passwort von ${anna.name} neu gesetzt.`);
  await expect(page.getByRole("heading", { level: 1, name: anna.name })).toBeVisible();
  expect(await canLogIn(browser, { ...anna, password: "anna-new-pw1" })).toBe(true);
});

test("ST-081: A rejected password reset names the reason at the form", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openFromTheList(page, anna.name);

  await page.getByLabel("Neues Passwort").fill("short6");
  await page.getByRole("button", { name: "Passwort zurücksetzen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Das Passwort braucht mindestens 10 Zeichen.");
  await expect(page.getByLabel("Neues Passwort")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Neues Passwort")).toHaveValue("");
  expect(await canLogIn(browser, anna)).toBe(true);
});

test("ST-081: Creating a team member happens on its own page", async ({ page }) => {
  await page.goto("/team/members");
  await page.getByRole("link", { name: "Neues Teammitglied" }).click();
  await expect(page).toHaveURL(/\/team\/members\/new$/);

  const clara = await aTeamMember(page, { name: "Clara Vogt" });

  await expect(page).toHaveURL(/\/team\/members\?created=/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`${clara.name} ist angelegt.`);
  await expect(page.getByRole("main").getByRole("link", { name: clara.name, exact: true })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-081: A rejected creation keeps what was typed, never the password", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });

  await page.goto("/team/members/new");
  await page.getByLabel("Name", { exact: true }).fill("Anna Bauer");
  await page.getByLabel("Benutzername").fill(anna.username);
  await page.getByLabel("Anfangspasswort").fill("e2e-secret-10");
  await page.getByLabel("Rolle").selectOption("helper");
  await page.getByRole("button", { name: "Teammitglied anlegen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dieser Benutzername ist schon vergeben.");
  await expect(page.getByLabel("Benutzername")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Benutzername")).toHaveValue(anna.username);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Anna Bauer");
  await expect(page.getByLabel("Rolle")).toHaveValue("helper");
  await expect(page.getByLabel("Anfangspasswort")).toHaveValue("");
});

test("ST-081: Helpers do not reach the team members page", async ({ page }) => {
  const helper = await aHelper(page);
  await logIn(page, helper);

  // Opened, so the missing link is really missing – not just hidden in the closed "Mehr" (ST-008).
  await openMore(page);
  await expect(page.getByRole("link", { name: "Teammitglieder" })).toHaveCount(0);
  for (const address of ["/team/members", "/team/members/new"]) {
    await page.goto(address);
    await expect(page).toHaveURL(/\/team$/);
  }
});

test("ST-081: Deactivating asks once and names the person", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  const herPhone = await aPhoneLoggedInAs(browser, anna);
  await openFromTheList(page, anna.name);

  await page.getByRole("link", { name: "Konto deaktivieren" }).click();

  await expect(page).toHaveURL(/\/deaktivieren$/);
  await expect(page.getByRole("main")).toContainText(
    `Konto von ${anna.name} deaktivieren? ${firstNameOf(anna.name)} wird sofort abgemeldet.`,
  );
  await expect(page.getByRole("button", { name: "Konto deaktivieren" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zurück" })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  expect(await stillLoggedIn(herPhone)).toBe(true);

  await page.getByRole("button", { name: "Konto deaktivieren" }).click();

  await expect(page).toHaveURL(/\/team\/members\/[0-9a-f-]+\?done=deactivated$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${anna.name} deaktiviert.`);
  expect(await stillLoggedIn(herPhone)).toBe(false);
  await herPhone.context().close();
});

test("ST-081: Deactivating one's own account says so", async ({ page, browser }) => {
  const tom = await aTeamMember(page, { name: "Tom Keller", role: "technician" });
  await logIn(page, tom);
  await openFromTheList(page, tom.name);

  await page.getByRole("link", { name: "Konto deaktivieren" }).click();
  await expect(page.getByRole("main")).toContainText("Dein Konto deaktivieren? Du wirst sofort abgemeldet.");
  await page.getByRole("button", { name: "Konto deaktivieren" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/team");
  await expect(page).toHaveURL(/\/login$/);
  expect(await canLogIn(browser, tom)).toBe(false);
});

test("ST-081: Going back from the question changes nothing", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  const herPhone = await aPhoneLoggedInAs(browser, anna);
  await openFromTheList(page, anna.name);
  await page.getByRole("link", { name: "Konto deaktivieren" }).click();

  await page.getByRole("link", { name: "Zurück" }).click();

  await expect(page.getByRole("heading", { level: 1, name: anna.name })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Konto: aktiv");
  await expect(page.getByRole("main").getByRole("status")).toHaveCount(0);
  expect(await stillLoggedIn(herPhone)).toBe(true);
  await herPhone.context().close();
});

test("ST-081: A technician activates an account again", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await deactivate(page, anna.name);
  await openFromTheList(page, anna.name, { deactivated: true });
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.getByRole("button", { name: "Konto wieder aktivieren" }).click();

  await expect(page).toHaveURL(/\/team\/members\/[0-9a-f-]+\?done=activated$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${anna.name} wieder aktiviert.`);
  await expect(page.getByRole("main")).toContainText("Konto: aktiv");
  expect(await canLogIn(browser, anna)).toBe(true);
});

test("a deactivation another technician made meanwhile is said at the button, not swallowed", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openFromTheList(page, anna.name);
  await page.getByRole("link", { name: "Konto deaktivieren" }).click();

  // A second tab plays the other technician, who confirms first.
  const otherTab = await page.context().newPage();
  await deactivate(otherTab, anna.name);
  await otherTab.close();
  await page.getByRole("button", { name: "Konto deaktivieren" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dieses Konto ist deaktiviert.");
  await expect(page.getByRole("button", { name: "Konto deaktivieren" })).toHaveCount(0);
});

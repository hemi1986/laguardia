import type { Browser, Page } from "@playwright/test";
import {
  aHelper,
  allowPreview,
  aTeamMember,
  expect,
  logIn,
  openMore,
  pageWidth,
  test,
  unique,
  uniqueId,
  type Account,
} from "./fixtures";

/**
 * The team members page, one team member's page and their account edit page (ST-081, ST-088), at 360 px: editing an
 * account, deactivating it in one tap and activating it again. A team member's own phone is a browser context of its
 * own.
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
    await page.getByRole("button", { name: "Filtern" }).click();
    // Measured once the filtered list has loaded – not mid-navigation, before its styles apply.
    await expect(page).toHaveURL(/\/team\/members\?deaktivierte=1$/);
    await expect(page.getByLabel("Auch deaktivierte Konten anzeigen")).toBeChecked();
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  }
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function deactivate(page: Page, name: string) {
  await openFromTheList(page, name);
  await page.getByRole("button", { name: "Konto deaktivieren" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${name} deaktiviert.`);
}

/** The team member's account edit page, opened with „Konto bearbeiten“ on their page. */
async function openEditPage(page: Page, name: string) {
  await openFromTheList(page, name);
  await page.getByRole("link", { name: "Konto bearbeiten" }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Konto bearbeiten · ${name}` })).toBeVisible();
}

/** The reason of a rejection stands between the field it is about and „Konto speichern“ (G8). */
async function expectReasonAboveSave(page: Page) {
  const alert = await page.getByRole("main").getByRole("alert").boundingBox();
  const save = await page.getByRole("button", { name: "Konto speichern" }).boundingBox();
  expect(alert!.y).toBeLessThan(save!.y);
}

test.beforeEach(async ({ page }) => {
  const { E2E_TEAM_USERNAME: username, E2E_TEAM_PASSWORD: password, BASE_URL } = process.env;
  test.skip(!username || !password || !!BASE_URL, "needs a local technician account");
  await logIn(page);
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

test("ST-088: A technician changes name, username and role on the edit page", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  const newName = unique("Anna Schmidt");
  const newUsername = uniqueId("anna.s");
  await openEditPage(page, anna.name);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.getByLabel("Name", { exact: true }).fill(newName);
  await page.getByLabel("Benutzername").fill(newUsername);
  await page.getByLabel("Rolle").selectOption("technician");
  await page.getByRole("button", { name: "Konto speichern" }).click();

  await expect(page).toHaveURL(/\/team\/members\/[0-9a-f-]+\?done=saved$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${newName} gespeichert.`);
  await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(newUsername);
  await expect(page.getByRole("main")).toContainText("Techniker:in");
  expect(await canLogIn(browser, { username: newUsername, password: anna.password })).toBe(true);
  expect(await canLogIn(browser, anna)).toBe(false);
});

test("ST-088: Saving without a change is confirmed", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openEditPage(page, anna.name);

  await page.getByRole("button", { name: "Konto speichern" }).click();

  await expect(page).toHaveURL(/\/team\/members\/[0-9a-f-]+\?done=saved$/);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${anna.name} gespeichert.`);
});

test("ST-088: A password that is too short is rejected and the input kept", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  const newName = unique("Anna Schmidt");
  await openEditPage(page, anna.name);

  await page.getByLabel("Name", { exact: true }).fill(newName);
  await page.getByLabel("Neues Passwort").fill("short6");
  await page.getByRole("button", { name: "Konto speichern" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Das Passwort braucht mindestens 10 Zeichen.");
  await expectReasonAboveSave(page);
  await expect(page.getByLabel("Neues Passwort")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Neues Passwort")).toHaveValue("");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(newName);
  // The heading names the account as it is stored – still with her old name.
  await expect(page.getByRole("heading", { level: 1, name: `Konto bearbeiten · ${anna.name}` })).toBeVisible();
  expect(await canLogIn(browser, anna)).toBe(true);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-088: A username already taken is rejected and the new password not set", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  const tom = await aTeamMember(page, { name: "Tom Keller" });
  await openEditPage(page, anna.name);

  await page.getByLabel("Benutzername").fill(tom.username);
  await page.getByLabel("Neues Passwort").fill("anna-new-pw1");
  await page.getByRole("button", { name: "Konto speichern" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dieser Benutzername ist schon vergeben.");
  await expectReasonAboveSave(page);
  await expect(page.getByLabel("Benutzername")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Benutzername")).toHaveValue(tom.username);
  await expect(page.getByLabel("Neues Passwort")).toHaveValue("");
  expect(await canLogIn(browser, anna)).toBe(true);
  expect(await canLogIn(browser, { ...anna, password: "anna-new-pw1" })).toBe(false);
});

test("ST-088: An empty name is rejected", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  const newUsername = uniqueId("anna.b");
  await openEditPage(page, anna.name);

  // Blanks pass the browser's own check of a required field – the Team module decides.
  await page.getByLabel("Name", { exact: true }).fill("   ");
  await page.getByLabel("Benutzername").fill(newUsername);
  await page.getByLabel("Rolle").selectOption("technician");
  await page.getByRole("button", { name: "Konto speichern" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte einen Namen angeben.");
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Benutzername")).toHaveValue(newUsername);
  await expect(page.getByLabel("Rolle")).toHaveValue("technician");
  await expect(page.getByRole("heading", { level: 1, name: `Konto bearbeiten · ${anna.name}` })).toBeVisible();
});

test("ST-088: Deactivating is one tap without a question", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  const herPhone = await aPhoneLoggedInAs(browser, anna);
  await openFromTheList(page, anna.name);

  await page.getByRole("button", { name: "Konto deaktivieren" }).click();

  await expect(page).toHaveURL(/\/team\/members\/[0-9a-f-]+\?done=deactivated$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${anna.name} deaktiviert.`);
  await expect(page.getByRole("button", { name: "Konto wieder aktivieren" })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  expect(await stillLoggedIn(herPhone)).toBe(false);
  await herPhone.context().close();
});

test("ST-088: Activating again is one tap", async ({ page, browser }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await deactivate(page, anna.name);

  await page.getByRole("button", { name: "Konto wieder aktivieren" }).click();

  await expect(page).toHaveURL(/\/team\/members\/[0-9a-f-]+\?done=activated$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`Konto von ${anna.name} wieder aktiviert.`);
  await expect(page.getByRole("main")).toContainText("Konto: aktiv");
  expect(await canLogIn(browser, anna)).toBe(true);
});

test("ST-088: The old address of the question page leads to the team member's page", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openFromTheList(page, anna.name);
  const herPage = new URL(page.url()).pathname;

  await page.goto(`${herPage}/deaktivieren`);

  await expect(page).toHaveURL(new RegExp(`${herPage}$`));
  await expect(page.getByRole("heading", { level: 1, name: anna.name })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Konto: aktiv");
  await expect(page.getByRole("main").getByRole("status")).toHaveCount(0);
});

test("ST-088: Helpers do not reach the edit page", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openFromTheList(page, anna.name);
  const editPage = `${new URL(page.url()).pathname}/bearbeiten`;
  const helper = await aHelper(page);
  await logIn(page, helper);

  await page.goto(editPage);

  await expect(page).toHaveURL(/\/team$/);
  await openMore(page);
  await expect(page.getByRole("link", { name: "Teammitglieder" })).toHaveCount(0);
});

test("a deactivation another technician made meanwhile is said at the button, not swallowed", async ({ page }) => {
  const anna = await aTeamMember(page, { name: "Anna Berger" });
  await openFromTheList(page, anna.name);

  // A second tab plays the other technician, who taps first.
  const otherTab = await page.context().newPage();
  await deactivate(otherTab, anna.name);
  await otherTab.close();
  await page.getByRole("button", { name: "Konto deaktivieren" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dieses Konto ist deaktiviert.");
  await expect(page.getByRole("button", { name: "Konto deaktivieren" })).toHaveCount(0);
});

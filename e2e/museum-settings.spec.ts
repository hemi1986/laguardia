import { aHelper, allowPreview, expect, logIn, openMore, test, unique } from "./fixtures";

/**
 * The museum settings on a phone (ST-100): technicians reach them under „Mehr“, helpers find no way there and their
 * form is refused. No test here saves the museum form – the museum's name is one for the whole browser tests' database,
 * and the welcome page's test reads it; saving is tested at the page's integration test. Needs the e2e technician each
 * local run creates (ST-083), so this runs locally only.
 */
test.beforeEach(() => {
  test.skip(
    !process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD || !!process.env.BASE_URL,
    "needs a local technician account",
  );
});

test("ST-100: Technicians reach the museum settings under „Mehr“", async ({ page }) => {
  await logIn(page);

  await openMore(page);
  const more = page.getByRole("navigation").getByRole("listitem");
  await expect(more.nth(3)).toHaveText("Teammitglieder");
  await expect(more.nth(4)).toHaveText("Museumseinstellungen");
  await expect(more.nth(5)).toHaveText("Passwort ändern");
  await page.getByRole("navigation").getByRole("link", { name: "Museumseinstellungen" }).click();

  await expect(page).toHaveURL(/\/team\/museum-settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Museumseinstellungen" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Museum" })).toBeVisible();
  await expect(page.getByLabel("Name des Museums")).not.toBeEmpty();
  // The legal texts' form is the page's last section (ST-103) – its text areas span the column on a phone.
  await expect(page.getByRole("heading", { level: 2 }).last()).toHaveText("Rechtstexte");
  const privacyNotice = page.getByLabel("Datenschutzhinweis (Deutsch)");
  await expect(privacyNotice).not.toBeEmpty();
  await expect(page.getByLabel("Impressum (Englisch, freiwillig)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rechtstexte speichern" })).toBeVisible();
  const fieldWidth = (await privacyNotice.boundingBox())!.width;
  expect(fieldWidth).toBeGreaterThan(280);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole("link", { name: "Startseite ansehen" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/\S/);
});

test("ST-100: Helpers do not get the museum settings", async ({ page, browser }) => {
  await logIn(page);
  const helper = await aHelper(page);
  const helperPhone = await browser.newPage();
  await allowPreview(helperPhone, test.info().project.use.baseURL);
  await logIn(helperPhone, helper);

  await openMore(helperPhone);
  await expect(helperPhone.getByRole("navigation").getByRole("link", { name: "Museumseinstellungen" })).toHaveCount(0);
  await helperPhone.goto("/team/museum-settings");
  await expect(helperPhone).toHaveURL(/\/team$/);

  await page.goto("/");
  const before = await page.getByRole("heading", { level: 1 }).textContent();

  // The form as a technician's page shows it, sent with the helper's session.
  await logIn(page);
  await page.goto("/team/museum-settings");
  await page.context().clearCookies();
  await page.context().addCookies(await helperPhone.context().cookies());
  const name = unique("Helpers' museum");
  await page.getByLabel("Name des Museums").fill(name);
  await page.getByRole("button", { name: "Museum speichern" }).click();
  await expect(page).toHaveURL(/\/team$/);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(before ?? "");
  await helperPhone.close();
});

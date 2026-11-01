import { aHelper, allowPreview, expect, logIn, openMore, test } from "./fixtures";

/**
 * „Einstellungen“ on a phone (ST-104): technicians reach the page under „Mehr“ where „Museumseinstellungen“ was, with the
 * sections „Museum“, „Logo“, „Rechtstexte“ and „KI“; helpers find no way there and their form „KI“ is refused. No test
 * here saves the AI settings – the browser tests never reach OpenRouter (`scripts/e2e-server.ts` points it where nothing
 * answers), so the form shows the typed model IDs; saving is tested at the page's integration test. Needs the e2e
 * technician each local run creates (ST-083), so this runs locally only.
 */
test.beforeEach(() => {
  test.skip(
    !process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD || !!process.env.BASE_URL,
    "needs a local technician account",
  );
});

test("ST-104: Technicians reach „Einstellungen“ under „Mehr“", async ({ page }) => {
  await logIn(page);

  await openMore(page);
  const more = page.getByRole("navigation").getByRole("listitem");
  await expect(more.nth(3)).toHaveText("Teammitglieder");
  await expect(more.nth(4)).toHaveText("Einstellungen");
  await expect(more.nth(5)).toHaveText("Passwort ändern");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Museumseinstellungen" })).toHaveCount(0);
  await page.getByRole("navigation").getByRole("link", { name: "Einstellungen" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Museum", "Logo", "Rechtstexte", "KI"]);
  await expect(page.getByText("KI ist aus. Es fehlen:")).toBeVisible();
  await expect(page.getByLabel("OpenRouter-API-Schlüssel")).toHaveAttribute("type", "password");
  await expect(page.getByText("Die Modellliste von OpenRouter ließ sich nicht laden.")).toBeVisible();
  await expect(page.getByRole("button", { name: "KI speichern" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("ST-104: Helpers do not get the AI settings", async ({ page, browser }) => {
  await logIn(page);
  const helper = await aHelper(page);
  const helperPhone = await browser.newPage();
  await allowPreview(helperPhone, test.info().project.use.baseURL);
  await logIn(helperPhone, helper);

  await openMore(helperPhone);
  await expect(helperPhone.getByRole("navigation").getByRole("link", { name: "Einstellungen" })).toHaveCount(0);
  await helperPhone.goto("/team/museum-settings");
  await expect(helperPhone).toHaveURL(/\/team$/);

  // The form „KI“ as a technician's page shows it, sent with the helper's session.
  await logIn(page);
  await page.goto("/team/museum-settings");
  await page.context().clearCookies();
  await page.context().addCookies(await helperPhone.context().cookies());
  await page.getByLabel("Chat-Modell").fill("google/gemini-2.5-flash");
  await page.getByRole("button", { name: "KI speichern" }).click();
  await expect(page).toHaveURL(/\/team$/);

  await page.context().clearCookies();
  await logIn(page);
  await page.goto("/team/museum-settings");
  await expect(page.getByText("KI ist aus. Es fehlen: API-Schlüssel, Chat-Modell, Embedding-Modell.")).toBeVisible();
  await helperPhone.close();
});

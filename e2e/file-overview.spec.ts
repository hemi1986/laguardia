import { expect, logIn, openMore, test, unique } from "./fixtures";

/**
 * The file overview „Dateien“ (ST-117) on a phone: reached through „Mehr“, filtered with a plain form (also without
 * JavaScript), and closed to someone not logged in. The paging and the filters' rules are proven against the database in
 * `file-overview.integration.test.ts`; here the browser shows the page works at 360 px.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test("ST-117: Someone not logged in does not reach the overview", async ({ page }) => {
  await page.goto("/team/dateien");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Dateien" })).toHaveCount(0);
});

test.describe("with a team account", () => {
  test.beforeEach(() => {
    test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  });

  test("a team member opens „Dateien“ under „Mehr“ and filters it, at 360 px", async ({ page }) => {
    await logIn(page);
    await openMore(page);
    await page.getByRole("link", { name: "Dateien" }).click();

    await expect(page).toHaveURL(/\/team\/dateien$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dateien" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    if ((await page.getByRole("combobox", { name: "Dateikategorie" }).count()) === 0) return; // no file yet (G7)

    await page.getByLabel("Dateikategorie").selectOption("photo");
    await page.getByRole("button", { name: "Filtern" }).click();

    await expect(page).toHaveURL(/\/team\/dateien\?fileCategory=photo(&attachedTo=)?$/);
    await expect(page.getByLabel("Dateikategorie")).toHaveValue("photo");
  });
});

test.describe("searching", () => {
  test.beforeEach(() => {
    test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  });

  test("a file is found by what was typed – also by a plain form without JavaScript, at 360 px", async ({
    page,
    browser,
  }) => {
    await logIn(page);
    const title = unique("Coilwork");
    await page.goto("/team/dateien/hinzufuegen");
    await page
      .getByLabel("Datei", { exact: true })
      .setInputFiles({ name: "backbox_manual-v2.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") });
    await expect(page.getByRole("status").filter({ hasText: "Hochgeladen: backbox_manual-v2.pdf" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel("Titel").fill(title);
    await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
    await page.getByRole("button", { name: "Datei hinzufügen" }).click();
    await expect(page).toHaveURL(/\/team\/dateien\/[^/]+\/details/);

    await page.goto("/team/dateien");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expect(page.getByText("im Inhalt nur bei Dateien, die für die KI erfasst sind")).toBeVisible();
    await page.getByLabel("Suche", { exact: true }).fill("backbox_manual");
    await page.getByRole("button", { name: "Suchen" }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    await page.getByLabel("Suche", { exact: true }).fill("Zylinderkopf");
    await page.getByRole("button", { name: "Suchen" }).click();
    await expect(page.getByText("Keine Datei passt zu dieser Suche.")).toBeVisible();
    await expect(page.getByLabel("Suche", { exact: true })).toHaveValue("Zylinderkopf");
    await page.getByRole("link", { name: "Alle Dateien anzeigen" }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    // The same search without JavaScript: a plain GET form.
    const plain = await browser.newContext({
      javaScriptEnabled: false,
      storageState: await page.context().storageState(),
    });
    try {
      const withoutScript = await plain.newPage();
      await withoutScript.goto("/team/dateien");
      await withoutScript.getByLabel("Suche", { exact: true }).fill(title.toLowerCase());
      await withoutScript.getByRole("button", { name: "Suchen" }).click();
      await expect(withoutScript).toHaveURL(/search=/);
      await expect(withoutScript.getByRole("link", { name: title })).toBeVisible();
    } finally {
      await plain.close();
    }
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test.beforeEach(() => {
    test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
  });

  test("the filters are a plain form whose choice stays in the address", async ({ page }) => {
    await logIn(page);
    await page.goto("/team/dateien?fileCategory=photo&page=3");

    await expect(page.getByRole("heading", { level: 1, name: "Dateien" })).toBeVisible();
    if ((await page.getByRole("combobox", { name: "Dateikategorie" }).count()) === 0) return; // no file yet (G7)
    await expect(page.getByLabel("Dateikategorie")).toHaveValue("photo");
    await page.getByLabel("Dateikategorie").selectOption("manual");
    await page.getByRole("button", { name: "Filtern" }).click();

    // Sending the filters starts at page 1: the page is not carried along.
    await expect(page).toHaveURL(/\/team\/dateien\?fileCategory=manual(&attachedTo=)?$/);
  });

  test("the search is a plain form that keeps the filter", async ({ page }) => {
    await logIn(page);
    await page.goto("/team/dateien?search=Relais&fileCategory=manual&page=2");

    await expect(page.getByRole("heading", { level: 1, name: "Dateien" })).toBeVisible();
    if ((await page.getByRole("button", { name: "Suchen" }).count()) === 0) return; // no file yet (G7)
    await expect(page.getByLabel("Suche", { exact: true })).toHaveValue("Relais");
    await expect(page.getByLabel("Dateikategorie")).toHaveValue("manual");

    // A new search starts at page 1 and keeps the filter; the filter keeps the words.
    await page.getByLabel("Suche", { exact: true }).fill("Spule");
    await page.getByRole("button", { name: "Suchen" }).click();
    await expect(page).toHaveURL(/\/team\/dateien\?search=Spule&fileCategory=manual$/);
    await page.getByLabel("Dateikategorie").selectOption("schematic");
    await page.getByRole("button", { name: "Filtern" }).click();
    await expect(page).toHaveURL(/\/team\/dateien\?search=Spule&fileCategory=schematic(&attachedTo=)?$/);
    await expect(page.getByLabel("Suche", { exact: true })).toHaveValue("Spule");
  });
});

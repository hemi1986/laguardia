import type { Browser, Page } from "@playwright/test";
import sharp from "sharp";
import { allowPreview, expect, openMore, test } from "./fixtures";

/**
 * The photo on a problem report on a phone (ST-016): a visitor takes or chooses a photo on the report form, the browser
 * prepares it, the server stores it in the private Blob store – locally the separate Development Blob store
 * (`BLOB_READ_WRITE_TOKEN` in `.env.development.local`) – and a technician sees it in the triage list. The machines are
 * registered by the e2e technician each local run creates (ST-083); the preview database has none before ST-068.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;
const needsMachines = () =>
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
const needsBlob = () => test.skip(!process.env.BLOB_READ_WRITE_TOKEN, "needs the Development Blob store");

async function logIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Benutzername").fill(username!);
  await page.getByLabel("Passwort").fill(password!);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/team$/);
}

/** A playable machine registered by the e2e technician, who logs out again – returns its museum number. */
async function aPlayableMachine(page: Page): Promise<string> {
  await logIn(page);
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

/** A phone camera photo: 4000 × 3000, stored sideways (EXIF orientation 6), with a GPS location. */
async function aCameraPhoto(): Promise<Buffer> {
  return sharp({ create: { width: 4000, height: 3000, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } })
    .toBuffer();
}

const unique = (text: string) => `${text} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

test("ST-016: Visitor adds a photo taken with the phone camera", async ({ page, browser }) => {
  needsMachines();
  needsBlob();
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE");
  const description = unique("Ball stuck behind the left ramp");

  await phone.goto(`/m/${museumNumber}/melden`);
  await phone.getByLabel("Was ist das Problem?").fill(description);
  await phone.getByLabel("Foto aufnehmen").setInputFiles({
    name: "IMG_0001.jpg",
    mimeType: "image/jpeg",
    buffer: await aCameraPhoto(),
  });
  await expect(phone.getByRole("button", { name: "Foto entfernen" })).toBeVisible();
  await phone.getByRole("button", { name: "Meldung senden" }).click();
  await expect(phone.getByText("Danke! Deine Meldung ist beim Team angekommen.")).toBeVisible();

  // The technician sees the stored photo – fetched at its short-lived address and inspected as stored.
  await logIn(page);
  await page.goto("/team/triage");
  const photo = page
    .getByRole("article")
    .filter({ hasText: description })
    .getByRole("img", { name: "Foto zur Meldung" });
  await expect(photo).toBeVisible();
  const stored = Buffer.from(await (await page.request.get((await photo.getAttribute("src"))!)).body());
  const meta = await sharp(stored).metadata();
  expect(meta.format).toBe("jpeg");
  expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2048);
  expect(meta.height!).toBeGreaterThan(meta.width!); // upright: the sideways camera photo is portrait
  expect(stored.byteLength).toBeLessThanOrEqual(1_000_000);
  expect(meta.exif).toBeUndefined();
  expect(meta.orientation).toBeUndefined();
});

test("ST-016: Photo above the size limit is rejected", async ({ page, browser }) => {
  needsMachines();
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "de-DE");

  await phone.goto(`/m/${museumNumber}/melden`);
  await phone.getByLabel("Was ist das Problem?").fill("Ball stuck");
  await phone.getByLabel("Foto auswählen").setInputFiles({
    name: "huge.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(20_000_001),
  });

  await expect(phone.getByText("Das Foto ist zu groß: höchstens 20 MB.")).toBeVisible();
  await expect(phone.getByRole("button", { name: "Foto entfernen" })).toHaveCount(0);
  await expect(phone.getByLabel("Was ist das Problem?")).toHaveValue("Ball stuck");
});

test("ST-016: Visitor sees the privacy notice", async ({ page, browser }) => {
  needsMachines();
  const museumNumber = await aPlayableMachine(page);
  const phone = await visitor(browser, "en-GB");

  await phone.goto(`/m/${museumNumber}/melden`);

  const photo = phone.getByRole("group", { name: "Photo (optional)" });
  await expect(photo.getByText("Only the museum's team members see the photo", { exact: false })).toBeVisible();
  await expect(photo.getByRole("link", { name: "Privacy notice" })).toHaveAttribute("href", "/datenschutz");
  expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

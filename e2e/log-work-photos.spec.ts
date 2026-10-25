import type { Page } from "@playwright/test";
import sharp from "sharp";
import { anOpenDefect, expect, logIn, openDefect, pageWidth, test } from "./fixtures";

/**
 * Photos on a work log entry on a phone (ST-032): the browser prepares each photo, the server stores them in the
 * private Blob store – locally the separate Development Blob store (`BLOB_READ_WRITE_TOKEN` in `.env.development.local`)
 * – and the defect's page shows them under the entry. Needs the e2e technician each local run creates (ST-083).
 */
test.beforeEach(async ({ page }) => {
  const { E2E_TEAM_USERNAME: username, E2E_TEAM_PASSWORD: password, BASE_URL } = process.env;
  test.skip(!username || !password || !!BASE_URL, "needs a local technician account");
  test.skip(!process.env.BLOB_READ_WRITE_TOKEN, "needs the Development Blob store");
  await logIn(page);
});

/** A phone camera photo: 4000 × 3000, stored sideways (EXIF orientation 6), with a GPS location. */
async function aCameraPhoto(name: string) {
  const buffer = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } })
    .toBuffer();
  return { name, mimeType: "image/jpeg", buffer };
}

/** The form „Arbeitsschritt eintragen“, reached from the defect's page, with two photos chosen. */
async function logWorkWithTwoPhotos(page: Page) {
  const { museumNumber, title } = await anOpenDefect(page);
  await openDefect(page, museumNumber, title);
  await page.getByRole("link", { name: "Arbeitsschritt eintragen" }).click();
  await page
    .getByLabel("Fotos auswählen")
    .setInputFiles([await aCameraPhoto("before.jpg"), await aCameraPhoto("after.jpg")]);
  await expect(page.getByRole("button", { name: "Foto entfernen" })).toHaveCount(2);
  await expect(page.getByRole("group", { name: "Fotos (optional, höchstens 5)" }).locator("img")).toHaveCount(2);
  return { title };
}

test("a team member logs work with two photos and sees them under the entry at 360 px", async ({ page }) => {
  await logWorkWithTwoPhotos(page);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await page.getByLabel("Was wurde gemacht?").fill("Replaced coil stop");
  await page.getByRole("button", { name: "Arbeitsschritt eintragen" }).click();

  await expect(page).toHaveURL(/\/team\/defects\/[0-9a-f-]+\?done=log-work$/);
  const entry = page.getByRole("article").filter({ hasText: "Replaced coil stop" });
  await expect(entry.getByRole("img", { name: "Foto zum Arbeitsschritt" })).toHaveCount(2);
  for (const photo of await entry.getByRole("img", { name: "Foto zum Arbeitsschritt" }).all()) {
    await expect(photo).toHaveJSProperty("complete", true);
    expect(await photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);
});

test("ST-032: A rejection says the photos must be chosen again", async ({ page }) => {
  await logWorkWithTwoPhotos(page);

  await page.getByRole("button", { name: "Arbeitsschritt eintragen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte kurz beschreiben, was gemacht wurde. Die Fotos müssen erneut ausgewählt werden.",
  );
  await expect(page.getByRole("button", { name: "Foto entfernen" })).toHaveCount(0);
  // No preview promises a photo the next send would not carry.
  await expect(page.getByRole("group", { name: "Fotos (optional, höchstens 5)" }).locator("img")).toHaveCount(0);
});

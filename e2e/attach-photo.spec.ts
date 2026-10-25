import type { Page } from "@playwright/test";
import sharp from "sharp";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * A camera photo as a file on a phone (ST-054): from the machine record's files section to its own page, where the
 * photo is taken (or chosen), prepared in the browser and stored through the server in the private Blob store –
 * locally the Development Blob store – as a file of the file category Photo.
 */
const needsTechnician = () =>
  test.skip(!process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD, "needs a technician account");
// The photo is stored before the command can reject it – without the store the answer is not-stored.
const needsBlob = () =>
  test.skip(!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BASE_URL, "needs the Development Blob store");

/** A phone camera's photo: sideways with EXIF orientation 6, and with a GPS location. */
async function aCameraPhoto() {
  const buffer = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg({ quality: 95 })
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } })
    .toBuffer();
  return { name: "IMG_0042.jpg", mimeType: "image/jpeg", buffer };
}

/** The photo page of a new machine of a new machine model, reached from its machine record. */
async function thePhotoForm(page: Page) {
  await logIn(page);
  const machine = await aMachine(page);
  await page.goto(`/team/machines/${machine.museumNumber}`);
  await page.getByRole("link", { name: "Foto aufnehmen" }).click();
  await expect(page.getByRole("heading", { name: `Foto an ${machine.museumNumber} anhängen` })).toBeVisible();
  return machine;
}

async function takeAPhoto(page: Page) {
  await page.getByLabel("Foto aufnehmen").setInputFiles(await aCameraPhoto());
  await expect(page.getByRole("button", { name: "Foto entfernen" })).toBeVisible();
}

const filesSection = (page: Page) =>
  page.locator("section").filter({ has: page.getByText("Dateien", { exact: true }) });

test("attaching a camera photo leads back to the machine record, which shows it under Foto", async ({ page }) => {
  needsTechnician();
  needsBlob();
  const { museumNumber } = await thePhotoForm(page);

  await takeAPhoto(page);
  await page.getByLabel("Titel").fill("Backbox wiring 2026");
  await page.getByLabel("Anhängen an").selectOption({ label: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Foto anhängen" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText("„Backbox wiring 2026“ angehängt.");
  const photos = filesSection(page)
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: "Foto" }) });
  const link = photos.getByRole("link", { name: "Backbox wiring 2026", exact: true });
  const opened = await page.request.get((await link.getAttribute("href"))!);
  expect(opened.status()).toBe(200);
  expect(opened.headers()["content-type"]).toBe("image/jpeg");
  expect((await sharp(await opened.body()).metadata()).exif).toBeUndefined();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("ST-054: A rejection says the photo must be chosen again", async ({ page }) => {
  needsTechnician();
  needsBlob();
  const { museumNumber } = await thePhotoForm(page);

  await takeAPhoto(page);
  await page.getByLabel("Anhängen an").selectOption({ label: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Foto anhängen" }).click(); // no title: rejected

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte einen Titel angeben. Das Foto muss erneut ausgewählt werden.",
  );
  // The chooser shows itself as empty rather than pretending the photo is still attached (G8a).
  await expect(page.getByRole("button", { name: "Foto entfernen" })).toHaveCount(0);
  await expect(page.getByLabel("Anhängen an")).toHaveValue("machine");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.goto(`/team/machines/${museumNumber}`);
  await expect(filesSection(page)).toContainText("Noch keine Dateien zu diesem Gerät oder seinem Modell.");
});

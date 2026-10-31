import sharp from "sharp";
import { allowPreview, expect, logIn, pageWidth, test } from "./fixtures";

/**
 * The museum's logo on a phone (ST-102): a technician uploads it in the museum settings – the file as chosen, through
 * the real store –, a visitor sees it above the museum name on the welcome page and gets it from `/logo` without logging
 * in, and the technician removes it again in one tap. What is stored, the rejections and the version check are tested
 * at the page's integration test. The logo is one for the browser tests' database, and this is the only spec that
 * changes it. Needs the e2e technician each local run creates (ST-083), so this runs locally only.
 */
test.use({ locale: "de-DE" });

test.beforeEach(() => {
  test.skip(
    !process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD || !!process.env.BASE_URL,
    "needs a local technician account",
  );
});

/** A wide transparent PNG with a red bar – a logo as a museum would have one. */
async function aLogoFile() {
  const buffer = await sharp({ create: { width: 1200, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 1200, height: 100, channels: 4, background: "#c00" } }, top: 150, left: 0 }])
    .png()
    .toBuffer();
  return { name: "logo.png", mimeType: "image/png", buffer };
}

const loaded = (image: import("@playwright/test").Locator) =>
  image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0);

test("a technician uploads the logo, visitors see it on the welcome page, and it is removed in one tap", async ({
  page,
  browser,
}) => {
  await logIn(page);
  await page.goto("/team/museum-settings");
  await expect(page.getByRole("heading", { level: 2, name: "Logo" })).toBeVisible();
  await expect(page.getByText("Noch kein Logo. Die Startseite zeigt nur den Namen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Logo entfernen" })).toHaveCount(0);

  await page.getByLabel("Bild", { exact: true }).setInputFiles(await aLogoFile());
  await page.getByRole("button", { name: "Logo hochladen" }).click();

  await expect(page.getByText("Logo gespeichert.")).toBeVisible();
  const current = page.getByRole("img", { name: "Das aktuelle Logo" });
  await expect.poll(() => loaded(current)).toBe(true);
  await expect(page.getByRole("button", { name: "Logo ersetzen" })).toBeVisible();
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  const visitorPhone = await (await browser.newContext({ locale: "de-DE" })).newPage();
  await allowPreview(visitorPhone, test.info().project.use.baseURL);
  await visitorPhone.goto("/");
  const logo = visitorPhone.getByRole("img", { name: "Logo des Museums" });
  await expect.poll(() => loaded(logo)).toBe(true);
  const [logoBox, nameBox] = [
    await logo.boundingBox(),
    await visitorPhone.getByRole("heading", { level: 1 }).boundingBox(),
  ];
  expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(nameBox!.y);
  expect(logoBox!.height).toBeLessThanOrEqual(800 / 3 + 1);
  expect(Math.abs(logoBox!.x + logoBox!.width / 2 - 180)).toBeLessThanOrEqual(2); // centred
  expect(await pageWidth(visitorPhone)).toBeLessThanOrEqual(360);
  const sentOn = await visitorPhone.request.get("/logo", { maxRedirects: 0 });
  expect(sentOn.status()).toBe(307);
  expect(sentOn.headers()["cache-control"]).toBe("private, max-age=60");

  await page.getByRole("button", { name: "Logo entfernen" }).click();

  await expect(page.getByText("Logo entfernt.")).toBeVisible();
  await expect(page.getByText("Noch kein Logo. Die Startseite zeigt nur den Namen.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Logo hochladen" })).toBeVisible();
  await visitorPhone.reload();
  await expect(visitorPhone.getByRole("img")).toHaveCount(0);
  expect((await visitorPhone.request.get("/logo", { maxRedirects: 0 })).status()).toBe(404);
});

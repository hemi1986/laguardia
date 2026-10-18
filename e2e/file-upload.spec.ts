import type { Page, Request } from "@playwright/test";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * The direct file upload on a phone (ST-085, ADR 0006/0009): a technician chooses a file on the check page, the
 * browser asks the server for an upload address and uploads the file straight to the private Blob store – locally
 * the separate Development Blob store (`BLOB_READ_WRITE_TOKEN` in `.env.development.local`). ST-037's form for attaching
 * files replaces the check page.
 */
const needsTechnician = () =>
  test.skip(!process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD, "needs a technician account");
const needsBlob = () =>
  test.skip(!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BASE_URL, "needs the Development Blob store");

const MB = 1024 * 1024;

/** The check page of a new machine, opened by the logged-in e2e technician. */
async function theUploadCheck(page: Page): Promise<void> {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await page.goto(`/team/machines/${museumNumber}/upload-pruefen`);
}

function aPdf(size: number) {
  const buffer = Buffer.alloc(size, 0x20);
  buffer.write("%PDF-1.4\n", 0);
  return { name: "manual.pdf", mimeType: "application/pdf", buffer };
}

/** Every request the page sends while `work` runs. */
async function requestsDuring(page: Page, work: () => Promise<void>): Promise<Request[]> {
  const sent: Request[] = [];
  const listener = (request: Request) => void sent.push(request);
  page.on("request", listener);
  await work();
  page.off("request", listener);
  return sent;
}

test("a file of about 25 MB goes as a multipart upload straight to the Blob store, never through a function", async ({
  page,
}) => {
  test.setTimeout(120_000);
  needsTechnician();
  needsBlob();
  await theUploadCheck(page);
  const origin = new URL(page.url()).origin;

  const sent = await requestsDuring(page, async () => {
    await page.getByLabel("Datei").setInputFiles(aPdf(25 * MB));
    await expect(page.getByRole("status").filter({ hasText: "Hochgeladen." })).toBeVisible({ timeout: 100_000 });
  });

  const toOurSite = sent.filter((request) => request.url().startsWith(origin));
  for (const request of toOurSite) expect(request.postDataBuffer()?.length ?? 0).toBeLessThan(10_000);
  const parts = sent.filter((request) => !request.url().startsWith(origin) && request.url().includes("/mpu"));
  expect(parts.length).toBeGreaterThan(1);
});

test("the progress of an upload is shown while it runs", async ({ page }) => {
  test.setTimeout(120_000);
  needsTechnician();
  needsBlob();
  await theUploadCheck(page);

  await page.getByLabel("Datei").setInputFiles(aPdf(25 * MB));

  await expect(page.getByRole("status").filter({ hasText: /Wird hochgeladen … \d+ %/ })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Hochgeladen." })).toBeVisible({ timeout: 100_000 });
});

test("a file above the size limit is refused by the upload permission itself, and the page says so", async ({
  page,
}) => {
  needsTechnician();
  needsBlob();
  await theUploadCheck(page);

  // The page asks for a limit of 1 KB; the file is 2 KB. Only the permission the server signed knows the limit.
  await page.getByLabel("Höchstgröße in Byte").fill("1024");
  await page.getByLabel("Datei").setInputFiles(aPdf(2048));

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Die Datei ist zu groß.");
});

test("uploaded content has its size in the store and opens only through its presigned address, not its plain store address", async ({
  page,
}) => {
  needsTechnician();
  needsBlob();
  await theUploadCheck(page);

  await page.getByLabel("Datei").setInputFiles(aPdf(4096));
  await expect(page.getByRole("status").filter({ hasText: "Hochgeladen." })).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText("Gespeichert: 4096 Byte")).toBeVisible();
  const storeAddress = (await page.locator("[data-store-address]").getAttribute("data-store-address"))!;
  const presigned = (await page.getByRole("link", { name: "Datei öffnen" }).getAttribute("href"))!;
  expect(new URL(presigned).searchParams.has("vercel-blob-signature")).toBe(true);
  expect((await page.request.get(storeAddress)).status()).toBe(403);
  const opened = await page.request.get(presigned);
  expect(opened.status()).toBe(200);
  expect((await opened.body()).subarray(0, 8).toString()).toBe("%PDF-1.4");
});

test("the upload works under the security headers: no request is blocked", async ({ page }) => {
  needsTechnician();
  needsBlob();
  await theUploadCheck(page);
  // Listening from here on, to what the upload sends. Next.js aborts its own page refreshes (ERR_ABORTED) when a newer
  // one starts – not a block; anything failing towards another host, or blocked, is.
  const origin = new URL(page.url()).origin;
  const blocked: string[] = [];
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    if (!request.url().startsWith(origin) || failure !== "net::ERR_ABORTED")
      blocked.push(`${request.url()}: ${failure}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|blocked/i.test(message.text()))
      blocked.push(message.text());
  });

  await page.getByLabel("Datei").setInputFiles(aPdf(4096));

  await expect(page.getByRole("status").filter({ hasText: "Hochgeladen." })).toBeVisible({ timeout: 30_000 });
  expect(blocked).toEqual([]);
});

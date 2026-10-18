import type { Page, Request } from "@playwright/test";
import { uploadPresigned } from "@vercel/blob/client";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * The direct file upload on a phone (ST-085, ADR 0006/0009): a team member chooses a file on the form that attaches it
 * (ST-037, which replaced ST-085's check page), the browser asks the server for an upload address and uploads the file
 * straight to the private Blob store – locally the separate Development Blob store (`BLOB_READ_WRITE_TOKEN` in
 * `.env.development.local`).
 */
const needsTechnician = () =>
  test.skip(!process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD, "needs a technician account");
const needsBlob = () =>
  test.skip(!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BASE_URL, "needs the Development Blob store");

const MB = 1024 * 1024;

/** The form that attaches a file to a new machine, opened by the logged-in e2e technician. */
async function theAttachForm(page: Page): Promise<string> {
  await logIn(page);
  const { museumNumber } = await aMachine(page);
  await page.goto(`/team/machines/${museumNumber}/datei-anhaengen`);
  return museumNumber;
}

function aPdf(size: number) {
  const buffer = Buffer.alloc(size, 0x20);
  buffer.write("%PDF-1.4\n", 0);
  return { name: "manual.pdf", mimeType: "application/pdf", buffer };
}

const uploaded = (page: Page) => page.getByRole("status").filter({ hasText: "Hochgeladen: manual.pdf" });

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
  await theAttachForm(page);
  const origin = new URL(page.url()).origin;

  const sent = await requestsDuring(page, async () => {
    await page.getByLabel("Datei", { exact: true }).setInputFiles(aPdf(25 * MB));
    await expect(uploaded(page)).toBeVisible({ timeout: 100_000 });
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
  await theAttachForm(page);

  await page.getByLabel("Datei", { exact: true }).setInputFiles(aPdf(25 * MB));

  await expect(page.getByRole("status").filter({ hasText: /Wird hochgeladen … \d+ %/ })).toBeVisible();
  await expect(uploaded(page)).toBeVisible({ timeout: 100_000 });
});

test("a file above the size limit is refused by the upload permission itself", async ({ page, context }) => {
  needsTechnician();
  needsBlob();
  await theAttachForm(page);
  const origin = new URL(page.url()).origin;
  const machineId = (await page.locator("form[data-machine-id]").getAttribute("data-machine-id"))!;
  const cookie = (await context.cookies(origin)).map(({ name, value }) => `${name}=${value}`).join("; ");

  // A limit of 1 KB, which only the permission the server signs knows – no form between the file and the store.
  const started = await page.request.post("/api/uploads", {
    headers: { origin },
    data: { type: "laguardia.pending-upload", owner: { machineId }, maximumSize: 1024 },
  });
  const { name } = (await started.json()) as { name: string };
  const upload = (bytes: number) =>
    uploadPresigned(name, new Blob([aPdf(bytes).buffer]), {
      access: "private",
      handleUploadUrl: `${origin}/api/uploads`,
      headers: { origin, cookie, ...bypass() },
      contentType: "application/pdf",
    });

  await expect(upload(2048)).rejects.toThrow("File is too large");
});

test("uploaded content opens only through its presigned address, not through its plain store address", async ({
  page,
}) => {
  needsTechnician();
  needsBlob();
  const museumNumber = await theAttachForm(page);
  await page.getByLabel("Datei", { exact: true }).setInputFiles(aPdf(4096));
  await expect(uploaded(page)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Titel").fill("Presigned only");
  await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
  await page.getByLabel("Anhängen an").selectOption({ label: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  const fileAddress = (await page.getByRole("link", { name: "Presigned only" }).getAttribute("href"))!;

  const redirect = await page.request.get(fileAddress, { maxRedirects: 0 });
  const presigned = new URL(redirect.headers()["location"]);
  expect(presigned.searchParams.has("vercel-blob-signature")).toBe(true);
  const opened = await page.request.get(presigned.toString());
  expect(opened.status()).toBe(200);
  expect((await opened.body()).subarray(0, 8).toString()).toBe("%PDF-1.4");
  expect((await page.request.get(`${presigned.origin}${presigned.pathname}`)).status()).toBe(403);
});

test("the upload works under the security headers: no request is blocked", async ({ page }) => {
  needsTechnician();
  needsBlob();
  await theAttachForm(page);
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

  await page.getByLabel("Datei", { exact: true }).setInputFiles(aPdf(4096));

  await expect(uploaded(page)).toBeVisible({ timeout: 30_000 });
  expect(blocked).toEqual([]);
});

/** The preview's protection bypass for requests outside the browser, as the browser tests' own requests carry it. */
function bypass(): Record<string, string> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret ? { "x-vercel-protection-bypass": secret } : {};
}

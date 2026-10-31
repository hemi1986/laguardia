import type { Page, Request } from "@playwright/test";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * The direct file upload on a phone (ST-085, ST-099, ADR 0009/0012): a team member chooses a file on the form that
 * attaches it (ST-037), the browser declares its size and media type, gets one presigned PUT for exactly that and
 * uploads the file straight to the private bucket – locally `laguardia-e2e` on SeaweedFS (`npm run db:up`), on a
 * preview the shared preview bucket on AWS S3.
 */
const needsTechnician = () =>
  test.skip(!process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD, "needs a technician account");

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

test("a file of about 25 MB goes in one PUT straight to the bucket, never through a function", async ({ page }) => {
  test.setTimeout(120_000);
  needsTechnician();
  await theAttachForm(page);
  const origin = new URL(page.url()).origin;

  const sent = await requestsDuring(page, async () => {
    await page.getByLabel("Datei", { exact: true }).setInputFiles(aPdf(25 * MB));
    await expect(uploaded(page)).toBeVisible({ timeout: 100_000 });
  });

  const toOurSite = sent.filter((request) => request.url().startsWith(origin));
  for (const request of toOurSite) expect(request.postDataBuffer()?.length ?? 0).toBeLessThan(10_000);
  const puts = sent.filter((request) => !request.url().startsWith(origin) && request.method() === "PUT");
  expect(puts).toHaveLength(1);
  expect(puts[0].url()).toContain("X-Amz-Signature=");
});

test("the progress of an upload is shown while it runs, up to 100 percent", async ({ page }) => {
  test.setTimeout(120_000);
  needsTechnician();
  await theAttachForm(page);
  // Every text the status shows, however briefly – 100 % is replaced by "Hochgeladen" right away.
  await page.evaluate(() => {
    const shown: string[] = [];
    (window as { shownStatus?: string[] }).shownStatus = shown;
    new MutationObserver(() => {
      for (const status of document.querySelectorAll("[role=status]")) shown.push(status.textContent ?? "");
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  await page.getByLabel("Datei", { exact: true }).setInputFiles(aPdf(25 * MB));

  await expect(page.getByRole("status").filter({ hasText: /Wird hochgeladen … \d+ %/ })).toBeVisible();
  await expect(uploaded(page)).toBeVisible({ timeout: 100_000 });
  const shown = await page.evaluate(() => (window as { shownStatus?: string[] }).shownStatus ?? []);
  expect(shown).toContainEqual(expect.stringContaining("Wird hochgeladen … 100 %"));
});

test("a file above the size limit gets no upload address, and the address takes no more than declared", async ({
  page,
}) => {
  needsTechnician();
  await theAttachForm(page);
  const origin = new URL(page.url()).origin;
  const machineId = (await page.locator("form[data-machine-id]").getAttribute("data-machine-id"))!;
  // A limit of 1 KB, which only the server knows – no form between the file and the store.
  const ask = (size: number) =>
    page.request.post("/api/uploads", {
      headers: { origin },
      data: {
        type: "laguardia.upload-address",
        owner: { machineId },
        size,
        contentType: "application/pdf",
        maximumSize: 1024,
      },
    });

  expect((await ask(2048)).status()).toBe(413);

  const issued = await ask(1024);
  expect(issued.status()).toBe(200);
  const { address } = (await issued.json()) as { address: { url: string; headers: Record<string, string> } };
  const sent = await fetch(address.url, { method: "PUT", headers: address.headers, body: aPdf(2048).buffer });
  expect(sent.status).toBe(403);
});

test("uploaded content opens only through its presigned address, not through its plain store address", async ({
  page,
}) => {
  needsTechnician();
  const museumNumber = await theAttachForm(page);
  await page.getByLabel("Datei", { exact: true }).setInputFiles(aPdf(4096));
  await expect(uploaded(page)).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Titel").fill("Presigned only");
  await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
  await page.getByLabel("Anhängen an").selectOption({ label: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  const fileAddress = (await page.getByRole("link", { name: "Presigned only", exact: true }).getAttribute("href"))!;

  const redirect = await page.request.get(fileAddress, { maxRedirects: 0 });
  const presigned = new URL(redirect.headers()["location"]);
  expect(presigned.searchParams.has("X-Amz-Signature")).toBe(true);
  const opened = await page.request.get(presigned.toString());
  expect(opened.status()).toBe(200);
  expect((await opened.body()).subarray(0, 8).toString()).toBe("%PDF-1.4");
  expect((await page.request.get(`${presigned.origin}${presigned.pathname}`)).status()).toBe(403);
});

test("the upload works under the security headers: no request is blocked", async ({ page }) => {
  needsTechnician();
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

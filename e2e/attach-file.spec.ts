import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { aMachine, allowPreview, expect, logIn, test } from "./fixtures";

/**
 * Attaching files on a phone (ST-037): the form on the machine's page uploads the chosen file straight to the private
 * Blob store (ST-085) – locally the Development Blob store – and the machine record lists the files by file category,
 * each opened through its own team-only address.
 */
const needsTechnician = () =>
  test.skip(!process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD, "needs a technician account");
const needsBlob = () =>
  test.skip(!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BASE_URL, "needs the Development Blob store");

const MB = 1024 * 1024;

/** A file of the given size on disk – Playwright sends files above 50 MB only from a path. */
function aFileOnDisk(name: string, size: number, start = "%PDF-1.4\n"): string {
  const buffer = Buffer.alloc(size, 0x20);
  buffer.write(start, 0);
  const path = test.info().outputPath(name);
  writeFileSync(path, buffer);
  return path;
}

/** The form that attaches a file to a new machine of a new machine model, opened by the logged-in e2e technician. */
async function theAttachForm(page: Page) {
  await logIn(page);
  const machine = await aMachine(page);
  await page.goto(`/team/machines/${machine.museumNumber}/datei-anhaengen`);
  return machine;
}

async function choose(page: Page, path: string, fileName: string, timeout = 30_000) {
  await page.getByLabel("Datei", { exact: true }).setInputFiles(path);
  await expect(page.getByRole("status").filter({ hasText: `Hochgeladen: ${fileName}` })).toBeVisible({ timeout });
}

async function fillIn(
  page: Page,
  { title, category, attachTo }: { title?: string; category: string; attachTo: string },
) {
  if (title !== undefined) await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Dateikategorie").selectOption({ label: category });
  await page.getByLabel("Anhängen an").selectOption({ label: attachTo });
}

/** The machine record's files section. */
const filesSection = (page: Page) =>
  page.locator("section").filter({ has: page.getByText("Dateien", { exact: true }) });

test("ST-037: Large manual is attached", async ({ page }) => {
  test.setTimeout(180_000);
  needsTechnician();
  needsBlob();
  const { title: machineModel } = await theAttachForm(page);

  await choose(page, aFileOnDisk("schematic.pdf", 60 * MB), "schematic.pdf", 150_000);
  await fillIn(page, {
    title: "MM Schematics",
    category: "Schaltplan",
    attachTo: `alle Geräte des Modells ${machineModel}`,
  });
  await page.getByRole("button", { name: "Datei anhängen" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText("„MM Schematics“ angehängt.");
  const link = filesSection(page).getByRole("link", { name: "MM Schematics", exact: true });
  const opened = await page.request.get((await link.getAttribute("href"))!);
  expect(opened.status()).toBe(200);
  expect(opened.headers()["content-type"]).toBe("application/pdf");
  expect(opened.headers()["content-disposition"] ?? "").not.toContain("attachment");
  expect((await opened.body()).length).toBe(60 * MB);
});

test("ST-037: Files above 100 MB are rejected", async ({ page }) => {
  test.setTimeout(120_000);
  needsTechnician();
  needsBlob();
  const { museumNumber } = await theAttachForm(page);

  await page.getByLabel("Datei", { exact: true }).setInputFiles(aFileOnDisk("scanned-manual.pdf", 120 * MB));

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dateien dürfen höchstens 100 MB groß sein.");
  await fillIn(page, { title: "MM scanned manual", category: "Handbuch", attachTo: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  await expect(page.getByRole("main").getByRole("alert").last()).toHaveText("Bitte eine Datei auswählen.");
  await page.goto(`/team/machines/${museumNumber}`);
  await expect(filesSection(page)).toContainText("Noch keine Dateien zu diesem Gerät oder seinem Modell.");
});

test("ST-037: Other formats are only downloaded", async ({ page }) => {
  needsTechnician();
  needsBlob();
  const { title: machineModel } = await theAttachForm(page);
  await choose(page, aFileOnDisk("sound.rom", 4096, "ROM"), "sound.rom");
  await fillIn(page, {
    title: "MM sound ROM image",
    category: "Sonstiges",
    attachTo: `alle Geräte des Modells ${machineModel}`,
  });
  await page.getByRole("button", { name: "Datei anhängen" }).click();

  const link = filesSection(page).getByRole("link", { name: "MM sound ROM image", exact: true });
  const opened = await page.request.get((await link.getAttribute("href"))!);

  expect(opened.status()).toBe(200);
  expect(opened.headers()["content-disposition"]).toContain("attachment");
});

test("ST-037: Files are team-only", async ({ page, browser }) => {
  needsTechnician();
  needsBlob();
  const { museumNumber } = await theAttachForm(page);
  await choose(page, aFileOnDisk("manual.pdf", 4096), "manual.pdf");
  await fillIn(page, { title: "MM Operations Manual", category: "Handbuch", attachTo: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  const fileAddress = (await filesSection(page)
    .getByRole("link", { name: "MM Operations Manual", exact: true })
    .getAttribute("href"))!;

  const stranger = await (await browser.newContext()).newPage();
  await allowPreview(stranger, test.info().project.use.baseURL);
  const answer = await stranger.request.get(fileAddress, { maxRedirects: 0 });

  expect(answer.status()).toBeGreaterThanOrEqual(300);
  expect(answer.status()).toBeLessThan(400);
  expect(new URL(answer.headers()["location"], page.url()).pathname).toBe("/login");
  expect(await answer.text()).not.toContain("%PDF");
  await stranger.context().close();
});

test("ST-037: A rejection says what happened to the chosen file", async ({ page }) => {
  needsTechnician();
  needsBlob();
  const { museumNumber } = await theAttachForm(page);
  await choose(page, aFileOnDisk("manual.pdf", 4096), "manual.pdf");
  await fillIn(page, { category: "Handbuch", attachTo: `nur ${museumNumber}` });

  await page.getByRole("button", { name: "Datei anhängen" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Bitte einen Titel angeben. Die gewählte Datei ist noch angehängt: manual.pdf",
  );
  await expect(page.getByRole("status").filter({ hasText: "Hochgeladen: manual.pdf" })).toBeVisible();
  await expect(page.getByLabel("Dateikategorie")).toHaveValue("manual");
  // Still attached: with a title, the same upload is attached – nothing to choose again.
  await page.getByLabel("Titel").fill("MM Operations Manual");
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("„MM Operations Manual“ angehängt.");
});

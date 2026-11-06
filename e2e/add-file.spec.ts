import { writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { aMachine, expect, logIn, test, unique } from "./fixtures";

/**
 * „Datei hinzufügen“ in the file overview on a phone (ST-119): the form on its own page uploads the chosen file straight
 * to the private bucket (ST-085, ST-099) – locally `laguardia-e2e` on SeaweedFS –, fills „Titel“ with the file's name
 * when JavaScript runs, and lands on the new file's details. What the rules do with the fields and the choice is proven
 * against the database in `add-file-from-overview.integration.test.ts`.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;
const needsTechnician = () => test.skip(!username || !password, "needs a technician account");

const MB = 1024 * 1024;
const address = "/team/dateien/hinzufuegen";

/** A file of the given size on disk – Playwright sends files above 50 MB only from a path. */
function aFileOnDisk(name: string, size: number): string {
  const buffer = Buffer.alloc(size, 0x20);
  buffer.write("%PDF-1.4\n", 0);
  const path = test.info().outputPath(name);
  writeFileSync(path, buffer);
  return path;
}

const aPdf = (name: string) => ({ name, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% manual\n") });

async function choose(
  page: Page,
  file: Parameters<ReturnType<Page["getByLabel"]>["setInputFiles"]>[0],
  fileName: string,
) {
  await page.getByLabel("Datei", { exact: true }).setInputFiles(file);
  await expect(page.getByRole("status").filter({ hasText: `Hochgeladen: ${fileName}` })).toBeVisible({
    timeout: 30_000,
  });
}

test("ST-119: Someone not logged in cannot add a file", async ({ page, baseURL }) => {
  await page.goto(address);

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Titel")).toHaveCount(0);

  // Sending the form is no way in either: the person is sent to the login and nothing is added.
  const sent = await page.request.post(address, {
    form: { title: "Sneaked in", fileCategory: "manual", content: "files/none", fileName: "x.pdf" },
    headers: { origin: baseURL! },
  });
  expect(sent.url()).toMatch(/\/login/);
});

test("ST-119: The title is filled in from the file name", async ({ page, browser }) => {
  needsTechnician();
  await logIn(page);
  await page.goto(address);
  await expect(page.getByLabel("Titel")).toHaveValue("");

  await choose(page, aPdf("medieval_manual-v2.pdf"), "medieval_manual-v2.pdf");
  await expect(page.getByLabel("Titel")).toHaveValue("medieval_manual-v2");
  await page.getByLabel("Titel").fill("MM Manual");
  await expect(page.getByLabel("Titel")).toHaveValue("MM Manual");

  // Choosing a file after typing a title leaves the typed title; the proposal never overwrites it.
  await choose(page, aPdf("another-file.pdf"), "another-file.pdf");
  await expect(page.getByLabel("Titel")).toHaveValue("MM Manual");

  // While the title still holds a proposal, the next file proposes its own.
  await page.getByLabel("Titel").fill("");
  await choose(page, aPdf("first.pdf"), "first.pdf");
  await expect(page.getByLabel("Titel")).toHaveValue("first");
  await choose(page, aPdf("second.pdf"), "second.pdf");
  await expect(page.getByLabel("Titel")).toHaveValue("second");

  // Without JavaScript the title stays empty: the same page in a browser context that runs none.
  const plain = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const withoutScript = await plain.newPage();
    await withoutScript.goto(address);
    await withoutScript.getByLabel("Datei", { exact: true }).setInputFiles(aPdf("medieval_manual-v2.pdf"));
    await expect(withoutScript.getByLabel("Titel")).toHaveValue("");
    await expect(withoutScript.getByRole("button", { name: "Datei hinzufügen" })).toBeVisible();
  } finally {
    await plain.close();
  }
});

test("adds a file from the file overview, attached to a machine, and keeps the name it came with", async ({ page }) => {
  needsTechnician();
  await logIn(page);
  const machine = await aMachine(page);
  const title = unique("MM Operations Manual");

  await page.goto("/team/dateien");
  await expect(page.getByRole("heading", { level: 1, name: "Dateien" })).toBeVisible();
  await page.getByRole("link", { name: "Datei hinzufügen" }).click();
  await expect(page).toHaveURL(/\/team\/dateien\/hinzufuegen$/);
  await expect(page.getByRole("heading", { level: 1, name: "Datei hinzufügen" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await choose(page, aPdf('weird "name"; v2.pdf'), 'weird "name"; v2.pdf');
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
  // The groups of the choice are folds: open the one holding the new machine, and tick it.
  await page.locator("details", { hasText: machine.museumNumber }).first().locator("summary").click();
  await page.getByLabel(new RegExp(`^${machine.museumNumber}`)).check();
  await page.getByRole("button", { name: "Datei hinzufügen" }).click();

  await expect(page).toHaveURL(/\/team\/dateien\/[^/]+\/details\?from=files&added=1$/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${title}“ hinzugefügt.`);
  await expect(page.getByText('Ursprünglicher Dateiname: weird "name"; v2.pdf')).toBeVisible();
  await expect(page.getByRole("main")).toContainText(machine.museumNumber);

  // The address that opens it carries the name it came with as its name.
  const opened = await page.request.get((await page.getByRole("link", { name: "Datei öffnen" }).getAttribute("href"))!);
  expect(opened.status()).toBe(200);
  const disposition = opened.headers()["content-disposition"] ?? "";
  expect(disposition).toContain("inline");
  expect(disposition).toContain(`filename*=UTF-8''weird%20%22name%22%3B%20v2.pdf`);

  await page.goto("/team/dateien");
  await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
});

test("ST-119: Files above 100 MB are rejected", async ({ page }) => {
  test.setTimeout(120_000);
  needsTechnician();
  await logIn(page);
  await page.goto(address);

  await page.getByLabel("Datei", { exact: true }).setInputFiles(aFileOnDisk("scanned-manual.pdf", 120 * MB));

  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Dateien dürfen höchstens 100 MB groß sein.");
  const title = unique("MM scanned manual");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
  await page.getByRole("button", { name: "Datei hinzufügen" }).click();

  // No file is added; what was typed is still filled in, and the form says nothing about choosing it again.
  await expect(page.getByRole("main").getByRole("alert").last()).toHaveText("Bitte eine Datei auswählen.");
  await expect(page.getByLabel("Titel")).toHaveValue(title);
  await expect(page.getByLabel("Dateikategorie")).toHaveValue("manual");
  await page.goto("/team/dateien");
  await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
});

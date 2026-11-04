import type { Page } from "@playwright/test";
import { aHelper, aMachine, expect, logIn, test } from "./fixtures";

/**
 * Removing a file on a phone (ST-121): „Datei entfernen“ on the file details leads to the question of its own (G10b),
 * which names the file, says that it is deleted for good and every machine and machine model it disappears from. The
 * machine record no longer removes a file – its former address leads to the details. Attaching uses the local bucket on
 * SeaweedFS (ST-099).
 */
const needsTechnician = () =>
  test.skip(!process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD, "needs a technician account");

/** A new machine of a new machine model with a small PDF of the model attached; ends on its machine record. */
async function aMachineWithFile(page: Page, title: string) {
  await logIn(page);
  const machine = await aMachine(page);
  await page.goto(`/team/machines/${machine.museumNumber}/datei-anhaengen`);
  await page.getByLabel("Datei", { exact: true }).setInputFiles({
    name: "manual.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n"),
  });
  await expect(page.getByRole("status").filter({ hasText: "Hochgeladen: manual.pdf" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
  await page.getByLabel("Anhängen an").selectOption({ label: `alle Geräte des Modells ${machine.title}` });
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${title}“ angehängt.`);
  return machine;
}

/** The machine record's files section. */
const filesSection = (page: Page) =>
  page.locator("section").filter({ has: page.getByText("Dateien", { exact: true }) });

/** The details address the machine record offers for that file. */
async function detailsAddress(page: Page, title: string): Promise<string> {
  const href = await page.getByRole("link", { name: `Details zu „${title}“` }).getAttribute("href");
  if (!href) throw new Error(`No details link for „${title}“`);
  return href;
}

/** The file ID in a details address. */
const fileIdOf = (details: string) => /\/team\/dateien\/([^/]+)\/details/.exec(details)![1];

test("ST-038: Removal needs a confirmation", async ({ page }) => {
  needsTechnician();
  const machine = await aMachineWithFile(page, "MM Operations Manual");

  await page.getByRole("link", { name: "Details zu „MM Operations Manual“" }).click();
  await page.getByRole("link", { name: "Datei entfernen" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Datei entfernen · MM Operations Manual" })).toBeVisible();
  await expect(page.getByText("„MM Operations Manual“ entfernen? Die Datei wird endgültig gelöscht.")).toBeVisible();
  await expect(page.getByText("Sie verschwindet bei:")).toBeVisible();
  await expect(page.getByText(`Alle Geräte des Modells ${machine.title}`)).toBeVisible();
  await page.getByRole("link", { name: "Zurück", exact: true }).click();

  // „Zurück“ returns to the details, and the file is still attached.
  await expect(page.getByRole("heading", { level: 1, name: "MM Operations Manual" })).toBeVisible();
  await expect(page.getByText(`Alle Geräte des Modells ${machine.title}`)).toBeVisible();
});

test("removes the file for good from its question, and its former address opens nothing", async ({ page }) => {
  needsTechnician();
  await aMachineWithFile(page, "MM Manual (wrong edition)");
  const details = await detailsAddress(page, "MM Manual (wrong edition)");
  const fileId = fileIdOf(details);

  await page.getByRole("link", { name: "Details zu „MM Manual (wrong edition)“" }).click();
  await page.getByRole("link", { name: "Datei entfernen" }).click();
  await page.getByRole("button", { name: "Endgültig entfernen" }).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/[^?]+\\?fileRemoved=${fileId}$`));
  await expect(page.getByRole("main").getByRole("status")).toHaveText("„MM Manual (wrong edition)“ entfernt.");
  await expect(filesSection(page)).not.toContainText("MM Manual (wrong edition)");
  expect((await page.request.get(`/team/dateien/${fileId}`, { maxRedirects: 0 })).status()).toBe(404);
});

test("ST-121: The machine record no longer removes a file, and its former address leads to the details", async ({
  page,
}) => {
  needsTechnician();
  const machine = await aMachineWithFile(page, "MM Operations Manual");
  const details = await detailsAddress(page, "MM Operations Manual");
  const fileId = fileIdOf(details);

  await expect(page.getByRole("link", { name: "Details zu „MM Operations Manual“" })).toBeVisible();
  await expect(page.getByRole("link", { name: "„MM Operations Manual“ entfernen" })).toHaveCount(0);

  await page.goto(`/team/machines/${machine.museumNumber}/datei-entfernen/${fileId}`);

  await expect(page).toHaveURL(
    new RegExp(`/team/dateien/${fileId}/details\\?from=machine(%3A|:)${machine.museumNumber}$`),
  );
  await expect(page.getByRole("heading", { level: 1, name: "MM Operations Manual" })).toBeVisible();
  await expect(page.getByText(`Alle Geräte des Modells ${machine.title}`)).toBeVisible();
});

test("a helper sees no way to remove a file and is sent back from the question", async ({ page }) => {
  needsTechnician();
  await aMachineWithFile(page, "Wiring notes");
  const details = await detailsAddress(page, "Wiring notes");
  const fileId = fileIdOf(details);
  const helper = await aHelper(page);
  await logIn(page, helper);

  await page.goto(details);
  await expect(page.getByRole("heading", { level: 1, name: "Wiring notes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Datei entfernen" })).toHaveCount(0);

  await page.goto(`/team/dateien/${fileId}/details/entfernen`);
  await expect(page).toHaveURL(/\/team$/);
});

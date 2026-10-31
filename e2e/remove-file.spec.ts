import type { Page } from "@playwright/test";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * Removing a file on a phone (ST-038): „Entfernen“ next to a file on the machine record leads to the question of its
 * own (G10b), which names the file and says that it is deleted for good. Attaching uses the local bucket on SeaweedFS (ST-099).
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

test("ST-038: Removal needs a confirmation", async ({ page }) => {
  needsTechnician();
  const machine = await aMachineWithFile(page, "MM Operations Manual");

  await filesSection(page).getByRole("link", { name: "„MM Operations Manual“ entfernen" }).click();
  // A file of the machine model also says where else it disappears (user, 2026-10-25, acceptance of ST-038).
  await expect(
    page.getByText(
      `„MM Operations Manual“ entfernen? Die Datei wird endgültig gelöscht. Sie verschwindet bei allen Geräten von ${machine.title}.`,
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Zurück", exact: true }).click();

  await expect(filesSection(page).getByRole("link", { name: "MM Operations Manual", exact: true })).toBeVisible();
});

test("removes the file for good from its question, and its former address opens nothing", async ({ page }) => {
  needsTechnician();
  await aMachineWithFile(page, "MM Manual (wrong edition)");
  const address = await filesSection(page)
    .getByRole("link", { name: "MM Manual (wrong edition)", exact: true })
    .getAttribute("href");

  await filesSection(page).getByRole("link", { name: "„MM Manual (wrong edition)“ entfernen" }).click();
  await page.getByRole("button", { name: "Endgültig entfernen" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText("„MM Manual (wrong edition)“ entfernt.");
  await expect(filesSection(page)).not.toContainText("MM Manual (wrong edition)");
  expect((await page.request.get(address!, { maxRedirects: 0 })).status()).toBe(404);
});

test("ST-091: The question before removing a file names the machine in its heading", async ({ page }) => {
  needsTechnician();
  const { museumNumber } = await aMachineWithFile(page, "Manual");

  await filesSection(page).getByRole("link", { name: "„Manual“ entfernen" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Datei entfernen · ${museumNumber}`);
});

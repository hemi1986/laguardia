import type { Page } from "@playwright/test";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * Correcting a file's title and file category (ST-116) on a phone: „Datei bearbeiten“ in the head of the file details
 * leads to the form with the current values (G34); saving lands on the details with the confirmation (G3). The upload uses
 * the local bucket on SeaweedFS (ST-099).
 */
const needsTechnician = () =>
  test.skip(!process.env.E2E_TEAM_USERNAME || !process.env.E2E_TEAM_PASSWORD, "needs a technician account");

/** A file attached to one machine only, through the machine record's own form (ST-037). */
async function aFileOnMachine(page: Page, museumNumber: string, title: string) {
  await page.goto(`/team/machines/${museumNumber}/datei-anhaengen`);
  await page.getByLabel("Datei", { exact: true }).setInputFiles({
    name: "manual.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n"),
  });
  await expect(page.getByRole("status").filter({ hasText: "Hochgeladen: manual.pdf" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Dateikategorie").selectOption({ label: "Sonstiges" });
  await page.getByLabel("Anhängen an").selectOption({ label: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${title}“ angehängt.`);
}

test("ST-116: Someone not logged in cannot correct a file", async ({ page }) => {
  await page.goto("/team/dateien/00000000-0000-4000-8000-000000000001/details/bearbeiten");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Titel")).toHaveCount(0);
});

test("corrects the title and the file category, and the machine record shows the file under its new group", async ({
  page,
}) => {
  needsTechnician();
  await logIn(page);
  const machine = await aMachine(page);
  await aFileOnMachine(page, machine.museumNumber, "MM Operations Manul");

  await page.getByRole("link", { name: "Details zu „MM Operations Manul“" }).click();
  await page.getByRole("link", { name: "Datei bearbeiten" }).click();
  await expect(page).toHaveURL(/\/team\/dateien\/[^/]+\/details\/bearbeiten\?from=machine/);
  await expect(page.getByRole("heading", { level: 1, name: "Datei bearbeiten · MM Operations Manul" })).toBeVisible();
  await expect(page.getByLabel("Titel")).toHaveValue("MM Operations Manul");
  await expect(page.getByLabel("Dateikategorie")).toHaveValue("other");

  // An empty title is rejected, marked, and what else was chosen stays.
  await page.getByLabel("Titel").fill("");
  await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
  await page.getByRole("button", { name: "Datei speichern" }).click();
  await expect(page.getByText("Bitte einen Titel angeben.")).toBeVisible();
  await expect(page.getByLabel("Titel")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Dateikategorie")).toHaveValue("manual");

  await page.getByLabel("Titel").fill("MM Operations Manual");
  await page.getByRole("button", { name: "Datei speichern" }).click();

  await expect(page).toHaveURL(/\/team\/dateien\/[^/]+\/details\?from=machine/);
  await expect(page.getByRole("main").getByRole("status")).toHaveText("„MM Operations Manual“ gespeichert.");
  await page.getByRole("link", { name: "Zurück zum Gerät" }).click();
  await expect(page.getByRole("link", { name: "MM Operations Manual" }).first()).toBeVisible();
});

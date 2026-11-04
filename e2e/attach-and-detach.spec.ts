import type { Page } from "@playwright/test";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * Attaching an existing file to a further machine and detaching it (ST-115) on a phone: „Anhängen“ at the end of
 * „Angehängt an“ leads to the grouped choice (G27), „Lösen“ is one tap without a question (G10a). The upload uses the
 * local bucket on SeaweedFS (ST-099).
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
  await page.getByLabel("Dateikategorie").selectOption({ label: "Handbuch" });
  await page.getByLabel("Anhängen an").selectOption({ label: `nur ${museumNumber}` });
  await page.getByRole("button", { name: "Datei anhängen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(`„${title}“ angehängt.`);
}

test("attaches a file to another machine and detaches it in one tap", async ({ page }) => {
  needsTechnician();
  await logIn(page);
  const first = await aMachine(page);
  const second = await aMachine(page);
  await aFileOnMachine(page, first.museumNumber, "MM Operations Manual");

  await page.getByRole("link", { name: "Details zu „MM Operations Manual“" }).click();
  await expect(page).toHaveURL(/\/team\/dateien\/[^/]+\/details\?from=machine/);
  await page.getByRole("link", { name: "Anhängen" }).click();
  await expect(page).toHaveURL(/\/team\/dateien\/[^/]+\/details\/anhaengen/);

  await expect(page.getByRole("heading", { level: 1, name: "Anhängen · MM Operations Manual" })).toBeVisible();
  const entry = page.getByLabel(`${second.museumNumber} · ${second.title}`);
  await page.locator("details").filter({ has: entry }).locator("summary").click();
  await entry.check();
  await page.getByRole("button", { name: "Anhängen" }).click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "„MM Operations Manual“ hängt jetzt an 2 Geräten.",
  );
  const attached = page.locator("section").filter({ has: page.getByText("Angehängt an", { exact: true }) });
  await expect(attached).toContainText(second.museumNumber);

  await attached
    .getByRole("listitem")
    .filter({ hasText: second.museumNumber })
    .getByRole("button", { name: "Lösen" })
    .click();

  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `„MM Operations Manual“ von ${second.museumNumber} gelöst.`,
  );
  await expect(attached).not.toContainText(second.museumNumber);
});

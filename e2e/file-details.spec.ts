import type { Page } from "@playwright/test";
import { aMachine, expect, logIn, test } from "./fixtures";

/**
 * The file details on a phone (ST-114): „Details“ next to a file on the machine record leads to the page of its own,
 * which says what the file is attached to and leads back to the machine. The old address of a file still opens the file.
 * Attaching uses the local bucket on SeaweedFS (ST-099).
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

test("a file's details are only for the team: nobody logged in is sent to the login", async ({ page }) => {
  await page.goto("/team/dateien/00000000-0000-4000-8000-000000000001/details");

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Handbuch")).toHaveCount(0);
});

test("opens the file's details from the machine record, leads back to the machine, and the file's address still opens it", async ({
  page,
}) => {
  needsTechnician();
  const machine = await aMachineWithFile(page, "MM Operations Manual");

  await page.getByRole("link", { name: "Details zu „MM Operations Manual“" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "MM Operations Manual" })).toBeVisible();
  await expect(page.getByText(/^Handbuch · PDF · /)).toBeVisible();
  await expect(page.getByText(`Alle Geräte des Modells ${machine.title}`)).toBeVisible();
  const open = page.getByRole("link", { name: "Datei öffnen" });
  const address = await open.getAttribute("href");
  // The address that opens a file (ST-037) is unchanged: it sends the browser on to the file itself.
  expect((await page.request.get(address!, { maxRedirects: 0 })).status()).toBe(303);

  await page.getByRole("link", { name: "Zurück zum Gerät" }).click();
  await expect(page).toHaveURL(new RegExp(`/team/machines/${machine.museumNumber}$`));
});

test("a file that was removed has no details page", async ({ page }) => {
  needsTechnician();
  await aMachineWithFile(page, "MM Manual (wrong edition)");
  await page.getByRole("link", { name: "Details zu „MM Manual (wrong edition)“" }).click();
  const detailsAddress = page.url();
  await page.goBack();
  await page.getByRole("link", { name: "„MM Manual (wrong edition)“ entfernen" }).click();
  await page.getByRole("button", { name: "Endgültig entfernen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("„MM Manual (wrong edition)“ entfernt.");

  await page.goto(detailsAddress);

  // The address leads nowhere: the not-found page, nothing of the file (the status of a streamed page is 200 in development).
  await expect(page.getByRole("heading", { level: 1, name: "MM Manual (wrong edition)" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Datei öffnen" })).toHaveCount(0);
});

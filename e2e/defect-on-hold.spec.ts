import type { Page } from "@playwright/test";
import { anOpenDefect, expect, logIn, openDefect, openDefectsEntry, pageWidth, test } from "./fixtures";

/**
 * Putting a defect on hold and resuming it on a phone (ST-029): the defect's page → „Pausieren“ → the form page →
 * back on the defect's page, which says the hold and confirms it; the open defects list says it too; „Fortsetzen“ is
 * one tap. Needs the e2e technician each local run creates (ST-083); runs locally only, like the other defect specs.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

async function openPutOnHold(page: Page, museumNumber: string, title: string) {
  await openDefect(page, museumNumber, title);
  await page.getByRole("main").getByRole("link", { name: "Pausieren" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Defekt pausieren · ${museumNumber}`);
}

test("a technician puts a defect on hold, the list says why, and one tap resumes it", async ({ page }) => {
  await logIn(page);
  const { museumNumber, title } = await anOpenDefect(page);
  await openPutOnHold(page, museumNumber, title);
  const main = page.getByRole("main");
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  // No reason chosen: asked for, the note is kept (G8).
  await page.getByLabel("Notiz (optional)").fill("Ordered new flyback");
  await main.getByRole("button", { name: "Pausieren" }).click();
  await expect(main.getByRole("alert")).toHaveText("Bitte einen Grund wählen.");
  await expect(page.getByLabel("Notiz (optional)")).toHaveValue("Ordered new flyback");
  await expect(page.getByLabel("Grund")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Grund").selectOption({ label: "Wartet auf Ersatzteil" });
  await main.getByRole("button", { name: "Pausieren" }).click();
  await expect(main.getByRole("status")).toHaveText(`„${title}“ ist pausiert – Wartet auf Ersatzteil.`);
  await expect(main).toContainText("Pausiert – Wartet auf Ersatzteil · Ordered new flyback");
  await expect(main.getByRole("link", { name: "Pausieren" })).toHaveCount(0);
  expect(await pageWidth(page)).toBeLessThanOrEqual(360);

  await expect(await openDefectsEntry(page, museumNumber)).toContainText("Pausiert – Wartet auf Ersatzteil");

  await openDefect(page, museumNumber, title);
  await main.getByRole("button", { name: "Fortsetzen" }).click();
  await expect(main.getByRole("status")).toHaveText(`„${title}“ geht weiter.`);
  await expect(main).not.toContainText("Pausiert –");
  await expect(main.getByRole("link", { name: "Pausieren" })).toBeVisible();
});

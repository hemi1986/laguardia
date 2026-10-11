import type { Page } from "@playwright/test";
import { aHelper, expect, logIn, test, uniqueId as unique } from "./fixtures";

/**
 * A team member reports a problem from the machine record on a phone (ST-015). Needs the e2e technician each local run
 * creates (ST-083); the preview database has none before ST-068, so this runs locally only.
 */
const username = process.env.E2E_TEAM_USERNAME;
const password = process.env.E2E_TEAM_PASSWORD;

test.beforeEach(() => {
  test.skip(!username || !password || !!process.env.BASE_URL, "needs a local technician account");
});

/** A machine that is not on display, registered by the e2e technician – team members may still report for it. */
async function aMachineNotOnDisplay(page: Page): Promise<string> {
  const title = unique("Medieval Madness");
  await page.goto("/team/machine-models");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Hersteller").fill("Williams");
  await page.getByLabel("Kategorie").selectOption("pinball");
  await page.getByRole("button", { name: "Modell anlegen" }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.goto("/team/machines/new");
  await page.getByLabel("Modell").selectOption({ label: `${title} (Williams)` });
  await page.getByLabel("Standort").fill("Workshop");
  await page.getByLabel("Status").selectOption("not-on-display");
  await page.getByRole("button", { name: "Gerät erfassen" }).click();
  return (await page.getByRole("main").getByRole("status").textContent())!.match(/LG-\d{3}/)![0];
}

test("a helper reports a problem from the machine record and is back there with a confirmation", async ({ page }) => {
  await logIn(page);
  const museumNumber = await aMachineNotOnDisplay(page);
  await logIn(page, await aHelper(page));

  await page.goto(`/team/machines/${museumNumber}`);
  await page.getByRole("link", { name: "Problem melden" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Problem melden · ${museumNumber}`);
  await page.getByRole("button", { name: "Meldung erfassen" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("Bitte beschreibe das Problem.");
  await expect(page.getByLabel("Beschreibung")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Beschreibung").fill("Rubber on the left slingshot cracked");
  await page.getByRole("button", { name: "Meldung erfassen" }).click();

  await expect(page).toHaveURL(new RegExp(`/team/machines/${museumNumber}\\?`));
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `Meldung zu ${museumNumber} erfasst – sie wartet auf die Sichtung.`,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

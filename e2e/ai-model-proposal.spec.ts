import { expect, test } from "@playwright/test";
import { turnAiOff, turnAiOn, withDatabase } from "./ai-seed";
import { logIn } from "./fixtures";

/**
 * ST-123 in a browser, without JavaScript: „Mit KI erstellen“ is absent while AI is off, the page of the same name sends
 * a description, the technician lands on the proposal's page – „KI arbeitet …“, refreshing itself through a meta tag –
 * and finds the proposal again under „KI-Vorschläge“ (G35, G37, G2a). The browser tests never reach OpenRouter, so this
 * spec seeds the AI settings into the browser tests' own database and is local-only (a preview has no such database).
 */

/** AI off again and the proposals removed – other specs read both (ST-104). */
async function restore(): Promise<void> {
  await withDatabase(async (client) => {
    await client.query("DELETE FROM ai_model_proposal");
    await turnAiOff(client);
  });
}

test.describe("AI model proposals on the machine models page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test.afterAll(restore);
  test.skip(!!process.env.BASE_URL, "seeds the local browser tests' database – no database behind a preview");
  test.skip(!process.env.E2E_TEAM_USERNAME, "no e2e technician configured");

  test("is not offered while AI is off", async ({ page }) => {
    await restore();
    await logIn(page);
    await page.goto("/team/machine-models");

    await expect(page.getByRole("heading", { name: "Modelle" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mit KI erstellen" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "KI-Vorschläge" })).toHaveCount(0);
  });

  test("sends a description, shows it being created and lists it under „KI-Vorschläge“", async ({ page }) => {
    await restore();
    await turnAiOn();
    await logIn(page);
    await page.goto("/team/machine-models");

    await page.getByRole("link", { name: "Mit KI erstellen" }).click();
    await expect(page.getByRole("heading", { name: "Mit KI erstellen" })).toBeVisible();

    // Blank: rejected, nothing created.
    await page.getByRole("button", { name: "Vorschlag erstellen" }).click();
    await expect(page.getByText("Bitte beschreibe das Gerät.")).toBeVisible();

    await page.getByLabel("Welches Gerät?").fill("Flipper High Speed Williams");
    await page.getByRole("button", { name: "Vorschlag erstellen" }).click();

    await expect(page).toHaveURL(/\/team\/machine-models\/ki-vorschlag\//);
    await expect(page.getByText("KI arbeitet …")).toBeVisible();
    await expect(page.getByText("Flipper High Speed Williams")).toBeVisible();
    // A meta refresh needs no JavaScript; it is what makes the page follow the writing.
    await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(1);

    await page.getByRole("link", { name: "Zurück zu den Modellen" }).click();
    await expect(page.getByRole("heading", { name: "KI-Vorschläge" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Flipper High Speed Williams" })).toBeVisible();

    // One is being written: another request is rejected and the typed description stays.
    await page.goto("/team/machine-models/mit-ki-erstellen");
    await expect(page.getByText("Es wird gerade schon ein KI-Vorschlag erstellt.")).toBeVisible();
  });
});

import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { turnAiOff, turnAiOn, withDatabase } from "./ai-seed";
import { logIn, pageWidth } from "./fixtures";

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

  /**
   * ST-124: the page of a written proposal. The browser tests never reach OpenRouter, so a written proposal is seeded as
   * the background work would have stored it (the work itself is tested at the run seam).
   */
  test("shows a written proposal: fields, what was not found, sources and documents", async ({ page }) => {
    await restore();
    await turnAiOn();
    const id = randomUUID();
    await withDatabase(async (client) => {
      const member = await client.query("SELECT id FROM team_member LIMIT 1");
      await client.query(
        `INSERT INTO ai_model_proposal
           (id, description, requested_by, requested_at, chat_model, state, title, manufacturer, machine_category,
            sources, documents, cost, changed_at)
         VALUES ($1, 'Flipper High Speed Williams', $2, now(), 'google/gemini-2.5-flash', 'written', 'High Speed',
                 'Williams', 'pinball', $3, $4, 0.04, now())`,
        [
          id,
          member.rows[0].id,
          ["https://www.ipdb.org/machine.cgi?id=1203"],
          JSON.stringify([
            {
              kind: "link",
              title: "High Speed – Manual",
              fileCategory: "manual",
              link: "https://www.ipdb.org/manual.pdf",
            },
          ]),
        ],
      );
    });
    await logIn(page);

    await page.goto(`/team/machine-models/ki-vorschlag/${id}`);

    await expect(page.getByLabel("Titel", { exact: true })).toHaveValue("High Speed");
    await expect(page.getByLabel("Hersteller")).toHaveValue("Williams");
    await expect(page.getByLabel("Kategorie", { exact: true })).toHaveValue("pinball");
    // The year and the technology were not found: empty, and the page says so beside them.
    await expect(page.getByLabel("Baujahr")).toHaveValue("");
    await expect(page.getByText("Nicht gefunden")).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Quellen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "https://www.ipdb.org/machine.cgi?id=1203" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aus dem Netz laden" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "„High Speed – Manual“ laden" })).toBeChecked();
    await expect(page.getByLabel("Dateikategorie von „High Speed – Manual“")).toHaveValue("manual");
    await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(0);
    // Usable at 360 px: nothing pushes the page wider than the screen.
    expect(await pageWidth(page)).toBeLessThanOrEqual(360);
  });
});

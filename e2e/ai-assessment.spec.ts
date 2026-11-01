import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { encryptKey } from "../src/modules/ai-assistance/key-encryption";
import { anOpenDefect, logIn, openDefect } from "./fixtures";

/**
 * ST-107 on the defect page in a browser, without JavaScript: the section „KI-Einschätzungen“ shows an AI assessment
 * being written, the page refreshes itself through a meta tag, and the refresh stops once it is written; the request
 * form's page leads back to the defect page after sending (G35, G2a). The browser tests never reach OpenRouter, and the
 * form cannot turn AI on there – so this spec seeds the AI settings and the requested AI assessment into the browser
 * tests' own database, and it is therefore local-only (a preview has no such database).
 */

const E2E_ENCRYPTION_KEY = Buffer.alloc(32, 7);

function e2eDatabase(): URL {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://laguardia:laguardia@localhost:5433/laguardia_test");
  url.pathname = "/laguardia_e2e_test";
  return url;
}

async function withDatabase<Result>(run: (client: Client) => Promise<Result>): Promise<Result> {
  const client = new Client({ connectionString: e2eDatabase().toString() });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Turns AI on in the browser tests' database: the key, the chat model and the embedding model (AGG-AiSettings). */
async function turnAiOn(): Promise<void> {
  await withDatabase((client) =>
    client.query(
      `UPDATE ai_settings
         SET encrypted_key = $1, key_last_four = 'a1b2',
             chat_model = 'google/gemini-2.5-flash', embedding_model = 'google/gemini-embedding-2',
             version = version + 1`,
      [encryptKey(E2E_ENCRYPTION_KEY, "sk-or-v1-e2e-browser-test-key-0123456789")],
    ),
  );
}

/** An AI assessment being written – no hold, so the page's refresh does not start a run. */
async function anAssessmentBeingWritten(defectId: string, note: string): Promise<string> {
  const id = randomUUID();
  await withDatabase((client) =>
    client.query(
      `INSERT INTO ai_assessment (id, defect_id, note, photos, requested_by, requested_at, chat_model, state, version)
       SELECT $1, $2, $3, '{}', id, now(), 'google/gemini-2.5-flash', 'requested', 0 FROM team_member LIMIT 1`,
      [id, defectId, note],
    ),
  );
  return id;
}

async function writeIt(aiAssessmentId: string): Promise<void> {
  await withDatabase((client) =>
    client.query(
      `UPDATE ai_assessment
         SET state = 'written', summary = $2, probable_causes = '{"Die Spule ist verschlissen."}',
             what_to_check_first = '{"Die Spule messen."}', "references" = '[]', files_searched = '{}',
             embedding_model = 'google/gemini-embedding-2', cost = 0.04, changed_at = now()
       WHERE id = $1`,
      [aiAssessmentId, "Die Spule ist schwach."],
    ),
  );
}

/** A defect "Left flipper weak" of its own machine; returns its page's address and its ID. */
async function aDefect(page: Page): Promise<{ address: string; defectId: string }> {
  const { museumNumber, title } = await anOpenDefect(page);
  await openDefect(page, museumNumber, title);
  const defectId = page.url().split("/").pop()!;
  return { address: `/team/defects/${defectId}`, defectId };
}

/** The defect is created on a phone with JavaScript; only the page under test must work without it. */
async function aDefectWithJavaScript(browser: Browser): Promise<{ address: string; defectId: string }> {
  const context = await browser.newContext({ javaScriptEnabled: true, viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await logIn(page);
  const defect = await aDefect(page);
  await context.close();
  return defect;
}

test.describe("AI assessments on the defect page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test.skip(!!process.env.BASE_URL, "seeds the local browser tests' database – no database behind a preview");
  test.skip(!process.env.E2E_TEAM_USERNAME, "no e2e technician configured");

  test("shows one being written and refreshes itself until it is written", async ({ browser, page }) => {
    await turnAiOn();
    const { address, defectId } = await aDefectWithJavaScript(browser);
    const aiAssessmentId = await anAssessmentBeingWritten(defectId, "Coil gets hot after 10 minutes");

    await logIn(page);
    await page.goto(address);

    await expect(page.getByRole("heading", { name: "KI-Einschätzungen" })).toBeVisible();
    await expect(page.getByText("KI-Einschätzung läuft …")).toBeVisible();
    await expect(page.getByText("Coil gets hot after 10 minutes")).toBeVisible();
    // A meta refresh needs no JavaScript; it is what makes the page follow the writing.
    await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(1);

    await writeIt(aiAssessmentId);
    await page.reload();

    await expect(page.getByText("Die Spule ist schwach.")).toBeVisible();
    await expect(page.getByText("Wahrscheinliche Ursachen")).toBeVisible();
    await expect(page.getByText("KI-Einschätzung läuft …")).toHaveCount(0);
    await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(0);
  });

  test("the request form's page sends without JavaScript and lands on the defect page", async ({ browser, page }) => {
    await turnAiOn();
    const { address } = await aDefectWithJavaScript(browser);

    await logIn(page);
    await page.goto(`${address}/ki-einschaetzung`);
    await expect(page.getByRole("heading", { name: /KI-Einschätzung anfordern · Left flipper weak/ })).toBeVisible();
    await expect(page.getByText("Fotos (freiwillig, höchstens 5)")).toBeVisible();
    await page.getByLabel("Was hast du beobachtet / was willst du wissen? (freiwillig)").fill("Coil gets hot");
    await page.getByRole("button", { name: "KI-Einschätzung anfordern" }).click();

    await expect(page).toHaveURL(new RegExp(`${address}$`));
    await expect(page.getByRole("heading", { name: "KI-Einschätzungen" })).toBeVisible();
    await expect(page.getByText("Coil gets hot")).toBeVisible();
  });
});

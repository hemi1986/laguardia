import { Client } from "pg";
import { encryptKey } from "../src/modules/ai-assistance/key-encryption";

/**
 * Seeding the AI settings into the browser tests' own database (local only, a preview has none): the browser tests never
 * reach OpenRouter, so the form „KI“ cannot turn AI on there. A spec that does must restore it afterwards and run in the
 * `ai-settings` project (`playwright.config.ts`), because the settings row is shared.
 */
const E2E_ENCRYPTION_KEY = Buffer.alloc(32, 7);

function e2eDatabase(): URL {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://laguardia:laguardia@localhost:5433/laguardia_test");
  url.pathname = "/laguardia_e2e_test";
  return url;
}

export async function withDatabase<Result>(run: (client: Client) => Promise<Result>): Promise<Result> {
  const client = new Client({ connectionString: e2eDatabase().toString() });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

/** Turns AI on in the browser tests' database: the key, the chat model and the embedding model (AGG-AiSettings). */
export async function turnAiOn(): Promise<void> {
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

/** Puts the AI settings back to "off" – other specs read them (ST-104). */
export async function turnAiOff(client: Client): Promise<void> {
  await client.query(
    `UPDATE ai_settings
       SET encrypted_key = NULL, key_last_four = NULL, chat_model = NULL, embedding_model = NULL,
           version = version + 1`,
  );
}

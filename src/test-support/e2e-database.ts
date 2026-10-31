import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { setUpFirstTechnician } from "@/modules/team";
import type { ContentStorage } from "@/platform/storage";
import { firstTechnicianRefusal } from "../../scripts/first-technician-messages";
import { testDatabaseUrl } from "./database";
import { resetDatabase } from "./reset-test-database";

/**
 * The database of the local browser tests (ST-083): `laguardia_e2e_test` on the server of the integration tests'
 * database – derived like `TEST_DATABASE_URL`, never from `DATABASE_URL`, so the developer's own data is never reset.
 */
export function e2eDatabaseUrl(): URL {
  const url = new URL(testDatabaseUrl());
  url.pathname = "/laguardia_e2e_test";
  return url;
}

/**
 * Creates the browser-test database if missing, drops everything in it and migrates it (`resetDatabase` refuses any
 * name not ending in `_test`), then creates the e2e technician through the Team module's first-technician setup.
 * Without a technician (E2E_TEAM_* unset) no account is created and the account-dependent specs skip.
 *
 * With a `storage`, the content the previous run stored is deleted from it first – every name its database still
 * knows – by name, the storage seam has no list operation. The local browser tests have a bucket of their own
 * (`laguardia-e2e`, ST-099), and their uploads (up to 100 MB each) would otherwise pile up in it run after run.
 */
export async function prepareE2eDatabase(
  url: URL,
  technician: { username: string; password: string } | undefined,
  storage?: Pick<ContentStorage, "delete">,
): Promise<void> {
  if (storage) for (const name of await storedContentOf(url)) await storage.delete(name);
  await resetDatabase(url);
  if (!technician) return;
  const pool = new Pool({ connectionString: url.toString(), max: 1 });
  try {
    const outcome = await setUpFirstTechnician(drizzle(pool), { name: "E2E Technician", ...technician });
    if (!outcome.ok) throw new Error(firstTechnicianRefusal(outcome.error));
  } finally {
    await pool.end();
  }
}

/**
 * The names of the content a browser-test database refers to: pending uploads, attached files and problem report
 * photos. None when the database or its tables do not exist yet – the first run.
 */
export async function storedContentOf(url: URL): Promise<string[]> {
  const client = new Client({ connectionString: url.toString() });
  try {
    await client.connect();
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM pending_upload
       UNION SELECT content FROM file
       UNION SELECT photo FROM problem_report WHERE photo IS NOT NULL`,
    );
    return rows.map((row) => row.name);
  } catch (error) {
    // 3D000: no such database, 42P01: no such table.
    if (["3D000", "42P01"].includes((error as { code?: string }).code ?? "")) return [];
    throw error;
  } finally {
    await client.end();
  }
}

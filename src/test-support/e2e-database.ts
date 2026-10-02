import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { setUpFirstTechnician } from "@/modules/team";
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
 */
export async function prepareE2eDatabase(
  url: URL,
  technician: { username: string; password: string } | undefined,
): Promise<void> {
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

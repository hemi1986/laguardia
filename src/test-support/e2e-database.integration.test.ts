import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { logIn } from "@/modules/team";
import { memoryStorage } from "@/platform/storage";
import { testDatabaseUrl } from "./database";
import { e2eDatabaseUrl, prepareE2eDatabase, storedContentOf } from "./e2e-database";

/**
 * The browser-test database (ST-083): reset, migrated and seeded with the e2e technician before the e2e server
 * starts. Tested on a database of its own, so it never resets `laguardia_e2e_test` under a running browser test.
 */
const url = new URL(testDatabaseUrl());
url.pathname = "/laguardia_e2e_prepare_test";
const technician = { username: "e2e_tech", password: "e2e-secret-10" };

async function query<Row>(sql: string): Promise<Row[]> {
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    return (await client.query(sql)).rows as Row[];
  } finally {
    await client.end();
  }
}

async function dropDatabase() {
  const server = new URL(url);
  server.pathname = "/postgres";
  const client = new Client({ connectionString: server.toString() });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${url.pathname.slice(1)}" WITH (FORCE)`);
  await client.end();
}

// DROP DATABASE forces a checkpoint – under the load of the whole test run it can take longer than the 10 s default.
afterAll(dropDatabase, 60_000);

describe("the browser-test database", () => {
  it("is laguardia_e2e_test on the server of the test database – never taken from DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "postgres://someone:secret@development.example:5432/laguardia");
    try {
      const e2e = e2eDatabaseUrl();

      expect(e2e.pathname).toBe("/laguardia_e2e_test");
      expect(e2e.host).not.toBe("development.example:5432");
      expect(e2e.username).not.toBe("someone");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("is created when missing and then holds exactly the e2e technician – again after a second preparation", async () => {
    await dropDatabase();

    await prepareE2eDatabase(url, technician);
    await query("INSERT INTO machine_model (title, manufacturer, machine_category) VALUES ('Left over', 'X', 'other')");
    await prepareE2eDatabase(url, technician);

    expect(await query("SELECT username, role FROM team_member")).toEqual([
      { username: "e2e_tech", role: "technician" },
    ]);
    expect(await query("SELECT count(*)::int AS count FROM machine_model")).toEqual([{ count: 0 }]);
    const pool = new Pool({ connectionString: url.toString(), max: 1 });
    expect(await logIn(technician, { db: drizzle(pool) })).toMatchObject({ ok: true });
    await pool.end();
  });

  it("seeds no account when no e2e technician is configured", async () => {
    await prepareE2eDatabase(url, undefined);

    expect(await query("SELECT count(*)::int AS count FROM team_member")).toEqual([{ count: 0 }]);
  });

  it("fails with the first-technician setup's message when the Team module rejects the password", async () => {
    await expect(prepareE2eDatabase(url, { username: "e2e_tech", password: "short" })).rejects.toThrow(
      "The password must have at least 10 characters – nothing was created.",
    );
  });

  it("deletes the content the previous run stored – every name its database knows, nothing else", async () => {
    await prepareE2eDatabase(url, technician);
    await query(`
      WITH tech AS (SELECT id FROM team_member),
        model AS (INSERT INTO machine_model (title, manufacturer, machine_category) VALUES ('M', 'X', 'other') RETURNING id),
        lg AS (INSERT INTO machine (id, museum_number, machine_model_id, location, machine_status, registered_at)
          SELECT gen_random_uuid(), 'LG-001', model.id, 'Hall 1', 'playable', now() FROM model RETURNING id),
        attached AS (INSERT INTO file (id, machine_model_id, title, file_category, content, size, content_type, attached_by, attached_at)
          SELECT gen_random_uuid(), model.id, 'Manual', 'manual', 'files/attached', 1, 'application/pdf', tech.id, now() FROM model, tech),
        pending AS (INSERT INTO pending_upload (name, machine_model_id, issued_to, issued_at, maximum_size)
          SELECT 'files/pending', model.id, tech.id, now(), 1 FROM model, tech)
      INSERT INTO problem_report (machine_id, reporter_kind, reported_at, description, photo)
        SELECT lg.id, 'visitor', now(), 'Flipper sticks', 'problem-reports/photo' FROM lg`);
    const storage = memoryStorage();
    for (const name of ["files/attached", "files/pending", "problem-reports/photo", "files/developers-own"])
      await storage.write(name, new Uint8Array([1]), "application/octet-stream");

    await prepareE2eDatabase(url, technician, storage);

    expect(storage.names()).toEqual(["files/developers-own"]);
    expect(await storedContentOf(url)).toEqual([]);
  });

  it("knows no stored content before the first run – no database yet", async () => {
    const never = new URL(url);
    never.pathname = "/laguardia_e2e_never_created_test";

    expect(await storedContentOf(never)).toEqual([]);
  });
});

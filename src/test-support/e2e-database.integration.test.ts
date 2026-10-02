import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { logIn } from "@/modules/team";
import { testDatabaseUrl } from "./database";
import { e2eDatabaseUrl, prepareE2eDatabase } from "./e2e-database";

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

afterAll(dropDatabase);

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

    expect(await query("SELECT username, role FROM team_member")).toEqual([{ username: "e2e_tech", role: "technician" }]);
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
});

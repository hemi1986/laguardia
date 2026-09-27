import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "@/test-support/database";
import { currentPerson, logIn, setUpFirstTechnician } from ".";
import { cookieHeader } from "./accounts.test-support";

/**
 * "No account yet" needs a database without team members – the shared test database has many. These tests run in
 * their own PostgreSQL schema with the team tables only, created from the migrated ones.
 */
const pool = new Pool({ connectionString: testDatabaseUrl(), max: 1, options: "-c search_path=setup_test,public" });
const db = drizzle(pool);

beforeAll(async () => {
  await db.execute(sql`DROP SCHEMA IF EXISTS setup_test CASCADE`);
  await db.execute(sql`CREATE SCHEMA setup_test`);
  for (const table of ["team_member", "session", "account", "verification", "failed_login"]) {
    await db.execute(sql.raw(`CREATE TABLE setup_test.${table} (LIKE public.${table} INCLUDING ALL)`));
  }
});

afterAll(async () => {
  await db.execute(sql`DROP SCHEMA IF EXISTS setup_test CASCADE`);
  await pool.end();
});

describe("setting up the first technician", () => {
  it("ST-004: First technician account is created at setup", async () => {
    const outcome = await setUpFirstTechnician(db, { name: "Tom", username: "tom", password: "tom-secret-10" });

    expect(outcome).toEqual({ ok: true });
    const loggedIn = await logIn({ username: "tom", password: "tom-secret-10" }, { db });
    if (!loggedIn.ok) throw new Error(loggedIn.error);
    const person = await currentPerson({ db, headers: new Headers({ cookie: cookieHeader(loggedIn.cookies) }) });
    expect(person).toMatchObject({ kind: "team-member", role: "technician" });
    const { rows } = await db.execute<{ name: string }>(sql`SELECT name FROM setup_test.team_member`);
    expect(rows).toEqual([{ name: "Tom" }]);
  });

  it("ST-004: Setup cannot be repeated once accounts exist", async () => {
    // Tom's account from the test above exists.
    const outcome = await setUpFirstTechnician(db, { name: "Eva", username: "eva", password: "eva-secret-10" });

    expect(outcome).toEqual({ ok: false, error: "accounts-exist" });
    const { rows } = await db.execute<{ username: string; name: string; role: string }>(
      sql`SELECT username, name, role FROM setup_test.team_member`,
    );
    expect(rows).toEqual([{ username: "tom", name: "Tom", role: "technician" }]);
  });

  it("refuses a password shorter than 10 characters", async () => {
    expect(await setUpFirstTechnician(db, { name: "Zoe", username: "zoe", password: "short" })).toEqual({
      ok: false,
      error: "password-too-short",
    });
  });

  it.each([
    ["a space", "Tom Weber"],
    ["too short", "to"],
    ["an umlaut", "jürgen"],
  ])("refuses a username that could never log in (%s)", async (_, username) => {
    expect(await setUpFirstTechnician(db, { name: "Tom", username, password: "tom-secret-10" })).toEqual({
      ok: false,
      error: "username-invalid",
    });
  });

  it("refuses an empty name", async () => {
    expect(await setUpFirstTechnician(db, { name: "  ", username: "tom", password: "tom-secret-10" })).toEqual({
      ok: false,
      error: "name-required",
    });
  });
});

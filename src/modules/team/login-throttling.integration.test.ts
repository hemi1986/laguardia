import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "@/test-support/database";
import { currentPerson, logIn } from ".";
import { aTeamMemberAccount, cookieHeader } from "./accounts.test-support";
import { failedLogin } from "./schema";

/**
 * The throttling rules of ST-004 move the clock weeks into the past, while `logIn` sweeps stale `failed_login`
 * rows of *every* username relative to the clock it is given (the only cleanup that table has – no scheduler,
 * ADR 0002). In the shared test database any other test that logs in at the real time would therefore sweep the
 * rows these tests just wrote. So they run in their own PostgreSQL schema with the team tables only.
 */
const pool = new Pool({
  connectionString: testDatabaseUrl(),
  max: 2,
  options: "-c search_path=throttling_test,public",
});
const db = drizzle(pool);

beforeAll(async () => {
  await db.execute(sql`DROP SCHEMA IF EXISTS throttling_test CASCADE`);
  await db.execute(sql`CREATE SCHEMA throttling_test`);
  for (const table of ["team_member", "session", "account", "verification", "failed_login"]) {
    await db.execute(sql.raw(`CREATE TABLE throttling_test.${table} (LIKE public.${table} INCLUDING ALL)`));
  }
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await db.execute(sql`DROP SCHEMA IF EXISTS throttling_test CASCADE`);
  await pool.end();
});

async function anna() {
  const username = `anna_${randomUUID().slice(0, 8)}`;
  const account = await aTeamMemberAccount(db, { name: "Anna", username, role: "helper", password: "anna-secret-10" });
  return { ...account, username, password: "anna-secret-10" };
}

describe("slowing repeated failed logins down", () => {
  it("ST-004: Repeated failed logins are slowed down", async () => {
    const { id, username, password } = await anna();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-01T08:00:00Z") });
    for (let attempt = 0; attempt < 10; attempt++) {
      vi.setSystemTime(new Date("2026-09-01T08:00:00Z").getTime() + attempt * 60_000); // within 10 minutes
      await logIn({ username, password: "not-the-password" }, { db });
    }

    vi.setSystemTime(new Date("2026-09-01T08:14:00Z"));
    // Rejected even with the correct password – the password is not checked while the username is locked.
    expect(await logIn({ username, password }, { db })).toEqual({ ok: false, error: "login-locked" });

    vi.setSystemTime(new Date("2026-09-01T08:30:00Z")); // more than 15 minutes after the 10th failure (08:09)
    const later = await logIn({ username, password }, { db });
    expect(later.ok).toBe(true);
    if (later.ok) {
      const headers = new Headers({ cookie: cookieHeader(later.cookies) });
      expect(await currentPerson({ db, headers })).toMatchObject({ teamMemberId: id });
    }
  });

  it("forgets failed logins after 30 minutes – they only matter for the lock", async () => {
    const { username } = await anna();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-01T08:00:00Z") });
    await logIn({ username, password: "not-the-password" }, { db });

    vi.setSystemTime(new Date("2026-09-01T08:31:00Z"));
    await logIn({ username: "someone_else", password: "not-the-password" }, { db });

    expect(await db.select().from(failedLogin).where(eq(failedLogin.username, username))).toEqual([]);
  });
});

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/platform/command";
import { testDatabaseUrl } from "@/test-support/database";
import { changeRole, deactivateAccount, teamMemberAccounts } from ".";
import { aTeamMemberAccount } from "./accounts.test-support";
import { account, session, teamMember } from "./schema";

/**
 * "The team can never lock itself out" counts the active technicians of the whole museum – which the shared test
 * database cannot hold still. These tests run in their own PostgreSQL schema with the team tables only.
 */
const pool = new Pool({
  connectionString: testDatabaseUrl(),
  max: 4, // two demotions at the same time need two connections
  options: "-c search_path=last_technician_test,public",
});
const db = drizzle(pool);

beforeAll(async () => {
  await db.execute(sql`DROP SCHEMA IF EXISTS last_technician_test CASCADE`);
  await db.execute(sql`CREATE SCHEMA last_technician_test`);
  for (const table of ["team_member", "session", "account", "verification", "failed_login"]) {
    await db.execute(sql.raw(`CREATE TABLE last_technician_test.${table} (LIKE public.${table} INCLUDING ALL)`));
  }
});

beforeEach(async () => {
  for (const table of [session, account, teamMember]) await db.delete(table);
});

afterAll(async () => {
  await db.execute(sql`DROP SCHEMA IF EXISTS last_technician_test CASCADE`);
  await pool.end();
});

async function aTechnician(name: string): Promise<Actor> {
  const { id } = await aTeamMemberAccount(db, {
    name,
    username: `${name.toLowerCase()}_${randomUUID().slice(0, 8)}`,
    role: "technician",
    password: `${name.toLowerCase()}-secret-10`,
  });
  return { kind: "team-member", teamMemberId: id, role: "technician" };
}

function idOf(actor: Actor): string {
  if (actor.kind !== "team-member") throw new Error("not a team member");
  return actor.teamMemberId;
}

async function activeTechnicians(): Promise<string[]> {
  const accounts = await teamMemberAccounts(db);
  return accounts.filter((a) => a.role === "technician" && a.active).map((a) => a.name);
}

describe("the team can never lock itself out", () => {
  it("ST-005: The last technician cannot lock the team out", async () => {
    const tom = await aTechnician("Tom");
    await aTeamMemberAccount(db, { name: "Anna", username: "anna", role: "helper", password: "anna-secret-10" });
    expect(await activeTechnicians()).toEqual(["Tom"]);

    const demoted = await changeRole({ teamMemberId: idOf(tom), role: "helper" }, { db, actor: tom });
    const deactivated = await deactivateAccount({ teamMemberId: idOf(tom) }, { db, actor: tom });

    expect(demoted).toEqual({ ok: false, error: "last-technician" });
    expect(deactivated).toEqual({ ok: false, error: "last-technician" });
    expect(await activeTechnicians()).toEqual(["Tom"]);
  });

  it("ST-005: Two technicians demote each other at the same time", async () => {
    const tom = await aTechnician("Tom");
    const eva = await aTechnician("Eva");
    expect(await activeTechnicians()).toEqual(["Eva", "Tom"]);

    const outcomes = await Promise.all([
      changeRole({ teamMemberId: idOf(eva), role: "helper" }, { db, actor: tom }),
      changeRole({ teamMemberId: idOf(tom), role: "helper" }, { db, actor: eva }),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([{ ok: false, error: "last-technician" }]);
    expect(await activeTechnicians()).toHaveLength(1);
  });
});

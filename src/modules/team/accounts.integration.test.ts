import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reportProblemCommand } from "@/modules/repair";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { changeRole, createAccount, currentPerson, deactivateAccount, logIn, resetPassword, teamMemberAccounts } from ".";
import { aTeamMemberAccount, cookieHeader } from "./accounts.test-support";

const db = testDatabase();

function aUsername(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/**
 * A logged-in technician who manages the accounts of a test – other tests' technicians do not disturb it.
 * Spread into the dependencies (`{ db, ...technician }`): Better Auth checks the session behind a password reset.
 */
async function aTechnician(): Promise<{ actor: Actor; headers: Headers }> {
  const username = aUsername("tom");
  const password = "tom-secret-10";
  const { id } = await aTeamMemberAccount(db, { name: "Tom", username, role: "technician", password });
  return {
    actor: { kind: "team-member", teamMemberId: id, role: "technician" },
    headers: await sessionOf(username, password),
  };
}

async function sessionOf(username: string, password: string): Promise<Headers> {
  const loggedIn = await logIn({ username, password }, { db });
  if (!loggedIn.ok) throw new Error(loggedIn.error);
  return new Headers({ cookie: cookieHeader(loggedIn.cookies) });
}

async function personBehind(username: string, password: string) {
  return currentPerson({ db, headers: await sessionOf(username, password) });
}

/** Anna, a helper with an account – the team member the scenarios manage. */
async function anna(technician: { actor: Actor; headers: Headers }) {
  const username = aUsername("anna");
  const password = "anna-secret-10";
  const created = await createAccount(
    { name: "Anna Berger", username, password, role: "helper" },
    { db, ...technician },
  );
  if (!created.ok) throw new Error(created.error);
  return { id: created.teamMemberId, username, password };
}

describe("managing team member accounts", () => {
  it("ST-005: Technician creates a helper account", async () => {
    const technician = await aTechnician();
    const username = aUsername("anna");

    const outcome = await createAccount(
      { name: "Anna Berger", username, password: "anna-secret-10", role: "helper" },
      { db, ...technician },
    );

    expect(outcome).toEqual({ ok: true, teamMemberId: expect.any(String) });
    expect(await personBehind(username, "anna-secret-10")).toEqual({
      kind: "team-member",
      teamMemberId: outcome.ok ? outcome.teamMemberId : undefined,
      role: "helper",
    });
  });

  it("ST-005: Username must be unique", async () => {
    const technician = await aTechnician();
    const username = aUsername("anna");
    const taken = await createAccount(
      { name: "Anna Berger", username, password: "anna-secret-10", role: "helper" },
      { db, ...technician },
    );
    expect(taken.ok).toBe(true);

    const outcome = await createAccount(
      { name: "Anna Bauer", username, password: "other-secret-10", role: "helper" },
      { db, ...technician },
    );

    expect(outcome).toEqual({ ok: false, error: "username-taken" });
  });

  it("ST-005: Technician changes a role", async () => {
    const technician = await aTechnician();
    const { id, username, password } = await anna(technician);
    const herPhone = await sessionOf(username, password);
    expect(await currentPerson({ db, headers: herPhone })).toMatchObject({ role: "helper" });

    const outcome = await changeRole({ teamMemberId: id, role: "technician" }, { db, ...technician });

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await currentPerson({ db, headers: herPhone })).toEqual({
      kind: "team-member",
      teamMemberId: id,
      role: "technician",
    });
  });

  it("ST-005: Technician resets a password", async () => {
    const technician = await aTechnician();
    const { id, username, password } = await anna(technician);

    const outcome = await resetPassword({ teamMemberId: id, password: "anna-forgot-10" }, { db, ...technician });

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await personBehind(username, "anna-forgot-10")).toMatchObject({ teamMemberId: id });
    expect(await logIn({ username, password }, { db })).toEqual({ ok: false, error: "login-failed" });
  });

  it("ST-005: Deactivating an account ends its sessions", async () => {
    const technician = await aTechnician();
    const { id, username, password } = await anna(technician);
    const herPhone = await sessionOf(username, password);
    // What she did stays hers: the work log (ST-020 ff.) is not built yet – a problem report she wrote stands in.
    const machineId = randomUUID();
    const her = await currentPerson({ db, headers: herPhone });
    await executeCommand(reportProblemCommand, { machineId, description: "Ball stuck" }, { actor: her, db });

    const outcome = await deactivateAccount({ teamMemberId: id }, { db, ...technician });

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await currentPerson({ db, headers: herPhone })).toEqual({ kind: "visitor" });
    expect(await logIn({ username, password }, { db })).toEqual({ ok: false, error: "login-failed" });
    expect((await journalOf(db, { machineId })).map((entry) => entry.actor)).toEqual([
      { kind: "team-member", teamMemberId: id, role: "helper" },
    ]);
    expect((await teamMemberAccounts(db)).find((account) => account.id === id)).toEqual({
      id,
      name: "Anna Berger",
      username,
      role: "helper",
      active: false,
    });
  });

  it("ST-005: Helpers cannot manage accounts", async () => {
    const technician = await aTechnician();
    const { id, username } = await anna(technician);
    const helper: Actor = { kind: "team-member", teamMemberId: id, role: "helper" };
    const newUsername = aUsername("berta");

    const attempts = [
      await createAccount(
        { name: "Berta", username: newUsername, password: "berta-secret-10", role: "helper" },
        { db, actor: helper },
      ),
      await changeRole({ teamMemberId: id, role: "technician" }, { db, actor: helper }),
      await resetPassword({ teamMemberId: id, password: "anna-forgot-10" }, { db, actor: helper }),
      await deactivateAccount({ teamMemberId: id }, { db, actor: helper }),
    ];

    expect(attempts).toEqual(Array(4).fill({ ok: false, error: "not-authorized" }));
    const accounts = await teamMemberAccounts(db);
    expect(accounts.find((account) => account.username === newUsername)).toBeUndefined();
    expect(accounts.find((account) => account.username === username)).toMatchObject({ role: "helper", active: true });
  });
});

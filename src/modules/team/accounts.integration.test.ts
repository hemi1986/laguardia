import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reportProblemCommand } from "@/modules/repair";
import { executeCommand, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import {
  activateAccount,
  createAccount,
  currentPerson,
  deactivateAccount,
  editAccount,
  logIn,
  teamMemberAccounts,
} from ".";
import { aTeamMemberAccount, cookieHeader } from "./accounts.test-support";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";

const db = testDatabase();

function aUsername(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/**
 * A logged-in technician who manages the accounts of a test – other tests' technicians do not disturb it.
 * Spread into the dependencies (`{ db, ...technician }`).
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

/**
 * Since ST-088 a role change and a password reset are an edit of the account, the rest of it sent as it is: Anna's
 * account as its edit page fills it in, with the given change.
 */
function annasEdit(
  { id, username }: { id: string; username: string },
  change: { role?: "helper" | "technician"; newPassword?: string },
) {
  return { teamMemberId: id, name: "Anna Berger", username, role: "helper", newPassword: "", ...change } as const;
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

    const outcome = await editAccount(annasEdit({ id, username }, { role: "technician" }), { db, ...technician });

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
    const herOldPhone = await sessionOf(username, password);

    const outcome = await editAccount(annasEdit({ id, username }, { newPassword: "anna-forgot-10" }), { db, ...technician });

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    // A reset is the remedy for a lost phone: whoever held the old session is logged out with the old password.
    expect(await currentPerson({ db, headers: herOldPhone })).toEqual({ kind: "visitor" });
    expect(await personBehind(username, "anna-forgot-10")).toMatchObject({ teamMemberId: id });
    expect(await logIn({ username, password }, { db })).toEqual({ ok: false, error: "login-failed" });
  });

  it("ST-005: Deactivating an account ends its sessions", async () => {
    const technician = await aTechnician();
    const { id, username, password } = await anna(technician);
    const herPhone = await sessionOf(username, password);
    // What she did stays hers: the work log (ST-020 ff.) is not built yet – a problem report she wrote stands in.
    const machineId = await aRegisteredMachine(db);
    const her = await currentPerson({ db, headers: herPhone });
    await executeCommand(reportProblemCommand, { machineId, description: "Ball stuck" }, { actor: her, db });

    const outcome = await deactivateAccount({ teamMemberId: id }, { db, ...technician });

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await currentPerson({ db, headers: herPhone })).toEqual({ kind: "visitor" });
    expect(await logIn({ username, password }, { db })).toEqual({ ok: false, error: "login-failed" });
    expect((await journalSinceRegistration(db, machineId)).map((entry) => entry.actor)).toEqual([
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

  it("activating a deactivated account again lets its team member log in with their password (ST-081)", async () => {
    const technician = await aTechnician();
    const { id, username, password } = await anna(technician);
    await deactivateAccount({ teamMemberId: id }, { db, ...technician });

    const outcome = await activateAccount({ teamMemberId: id }, { db, ...technician });

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await personBehind(username, password)).toMatchObject({ teamMemberId: id, role: "helper" });
    expect((await teamMemberAccounts(db, { includeDeactivated: false })).map((account) => account.id)).toContain(id);
  });

  it("a deactivated account can only be activated again – role, password and deactivation are refused (ST-081)", async () => {
    const technician = await aTechnician();
    const { id, username, password } = await anna(technician);
    await deactivateAccount({ teamMemberId: id }, { db, ...technician });

    const attempts = [
      await editAccount(annasEdit({ id, username }, { role: "technician" }), { db, ...technician }),
      await editAccount(annasEdit({ id, username }, { newPassword: "anna-forgot-10" }), { db, ...technician }),
      await deactivateAccount({ teamMemberId: id }, { db, ...technician }),
    ];

    expect(attempts).toEqual(Array(3).fill({ ok: false, error: "account-deactivated" }));
    await activateAccount({ teamMemberId: id }, { db, ...technician });
    expect(await personBehind(username, password)).toMatchObject({ teamMemberId: id, role: "helper" });
  });

  it("only technicians activate an account again (ST-081)", async () => {
    const technician = await aTechnician();
    const { id } = await anna(technician);
    await deactivateAccount({ teamMemberId: id }, { db, ...technician });
    const helper = { kind: "team-member", teamMemberId: id, role: "helper" } as const;

    expect(await activateAccount({ teamMemberId: id }, { db, actor: helper })).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect((await teamMemberAccounts(db)).find((account) => account.id === id)).toMatchObject({ active: false });
  });

  it("ST-005: Helpers cannot manage accounts", async () => {
    const technician = await aTechnician();
    const { id, username } = await anna(technician);
    const helper = { actor: { kind: "team-member", teamMemberId: id, role: "helper" } as Actor };
    const newUsername = aUsername("berta");

    const attempts = [
      await createAccount(
        { name: "Berta", username: newUsername, password: "berta-secret-10", role: "helper" },
        { db, ...helper },
      ),
      await editAccount(annasEdit({ id, username }, { role: "technician" }), { db, ...helper }),
      await editAccount(annasEdit({ id, username }, { newPassword: "anna-forgot-10" }), { db, ...helper }),
      await deactivateAccount({ teamMemberId: id }, { db, ...helper }),
    ];

    expect(attempts).toEqual(Array(4).fill({ ok: false, error: "not-authorized" }));
    const accounts = await teamMemberAccounts(db);
    expect(accounts.find((account) => account.username === newUsername)).toBeUndefined();
    expect(accounts.find((account) => account.username === username)).toMatchObject({ role: "helper", active: true });
  });

  it("ST-005: Passwords need at least 10 characters", async () => {
    const technician = await aTechnician();
    const her = await anna(technician);
    const nineCharacters = "short-one";
    expect(nineCharacters).toHaveLength(9);
    const username = aUsername("berta");

    const created = await createAccount(
      { name: "Berta", username, password: nineCharacters, role: "helper" },
      { db, ...technician },
    );
    const reset = await editAccount(annasEdit(her, { newPassword: nineCharacters }), { db, ...technician });

    expect(created).toEqual({ ok: false, error: "password-too-short" });
    expect(reset).toEqual({ ok: false, error: "password-too-short" });
    expect((await teamMemberAccounts(db)).find((account) => account.username === username)).toBeUndefined();
  });
});

describe("rejections no scenario names", () => {
  it("does not find an account that does not exist", async () => {
    const technician = await aTechnician();
    const unknown = randomUUID();

    const edit = annasEdit({ id: unknown, username: aUsername("anna") }, { newPassword: "long-enough-10" });

    expect(await editAccount(edit, { db, ...technician })).toEqual({ ok: false, error: "not-found" });
    expect(await deactivateAccount({ teamMemberId: unknown }, { db, ...technician })).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("lets only one of two technicians take the same username at the same time", async () => {
    const [tom, eva] = [await aTechnician(), await aTechnician()];
    const username = aUsername("anna");
    const account = { name: "Anna Berger", username, password: "anna-secret-10", role: "helper" } as const;

    const outcomes = await Promise.all([
      createAccount(account, { db, ...tom }),
      createAccount(account, { db, ...eva }),
    ]);

    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.filter((outcome) => !outcome.ok)).toEqual([{ ok: false, error: "username-taken" }]);
    expect((await teamMemberAccounts(db)).filter((a) => a.username === username)).toHaveLength(1);
  });
});

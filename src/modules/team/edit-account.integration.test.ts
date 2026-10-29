import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { createAccount, currentPerson, editAccount, logIn, teamMemberAccounts } from ".";
import { aTeamMemberAccount, cookieHeader } from "./accounts.test-support";

/**
 * Editing an account on one page (ST-088): name, username, role and a new password in one change, stored completely or
 * not at all. Other tests' technicians stay active in the shared test database, so no account here is the last one.
 */
const db = testDatabase();

function aUsername(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

async function aTechnician(): Promise<Actor> {
  const { id } = await aTeamMemberAccount(db, {
    name: "Tom Keller",
    username: aUsername("tom"),
    role: "technician",
    password: "tom-secret-10",
  });
  return { kind: "team-member", teamMemberId: id, role: "technician" };
}

/** Anna Berger, a helper – the team member the scenarios edit. */
async function anna(technician: Actor) {
  const username = aUsername("anna");
  const password = "anna-secret-10";
  const created = await createAccount(
    { name: "Anna Berger", username, password, role: "helper" },
    { db, actor: technician },
  );
  if (!created.ok) throw new Error(created.error);
  return { id: created.teamMemberId, username, password };
}

async function sessionOf(username: string, password: string): Promise<Headers> {
  const loggedIn = await logIn({ username, password }, { db });
  if (!loggedIn.ok) throw new Error(loggedIn.error);
  return new Headers({ cookie: cookieHeader(loggedIn.cookies) });
}

/** The account as the team members list shows it. */
async function stored(teamMemberId: string) {
  return (await teamMemberAccounts(db)).find((account) => account.id === teamMemberId);
}

async function canLogIn(username: string, password: string): Promise<boolean> {
  return (await logIn({ username, password }, { db })).ok;
}

describe("editing an account", () => {
  it("ST-088: A changed username keeps the sessions running", async () => {
    const tom = await aTechnician();
    const { id, username, password } = await anna(tom);
    const herPhone = await sessionOf(username, password);
    const newUsername = aUsername("anna.s");

    const outcome = await editAccount(
      { teamMemberId: id, name: "Anna Berger", username: newUsername, role: "helper", newPassword: "" },
      { db, actor: tom },
    );

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await currentPerson({ db, headers: herPhone })).toEqual({
      kind: "team-member",
      teamMemberId: id,
      role: "helper",
    });
    expect(await canLogIn(newUsername, password)).toBe(true);
    expect(await canLogIn(username, password)).toBe(false);
  });

  it("ST-088: A new password replaces the old one and ends the sessions", async () => {
    const tom = await aTechnician();
    const { id, username, password } = await anna(tom);
    const herPhone = await sessionOf(username, password);
    const twelveCharacters = "anna-new-pw1";
    expect(twelveCharacters).toHaveLength(12);

    const outcome = await editAccount(
      { teamMemberId: id, name: "Anna Berger", username, role: "helper", newPassword: twelveCharacters },
      { db, actor: tom },
    );

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await currentPerson({ db, headers: herPhone })).toEqual({ kind: "visitor" });
    expect(await canLogIn(username, twelveCharacters)).toBe(true);
    expect(await canLogIn(username, password)).toBe(false);
  });
});

describe("rejections of an edit, each decided before anything is written", () => {
  it("stores nothing of a change whose username is taken – not even its valid new password", async () => {
    const tom = await aTechnician();
    const her = await anna(tom);
    const other = await anna(tom);

    const outcome = await editAccount(
      {
        teamMemberId: her.id,
        name: "Anna Schmidt",
        username: other.username,
        role: "helper",
        newPassword: "anna-new-pw1",
      },
      { db, actor: tom },
    );

    expect(outcome).toEqual({ ok: false, error: "username-taken" });
    expect(await stored(her.id)).toMatchObject({ name: "Anna Berger", username: her.username });
    expect(await canLogIn(her.username, her.password)).toBe(true);
  });

  it("stores nothing of a change whose new password is too short, and keeps the sessions", async () => {
    const tom = await aTechnician();
    const { id, username, password } = await anna(tom);
    const herPhone = await sessionOf(username, password);

    const outcome = await editAccount(
      { teamMemberId: id, name: "Anna Schmidt", username, role: "helper", newPassword: "short6" },
      { db, actor: tom },
    );

    expect(outcome).toEqual({ ok: false, error: "password-too-short" });
    expect(await stored(id)).toMatchObject({ name: "Anna Berger" });
    expect(await currentPerson({ db, headers: herPhone })).toMatchObject({ teamMemberId: id });
  });

  it("rejects an empty name and an invalid username, and keeps the account", async () => {
    const tom = await aTechnician();
    const { id, username } = await anna(tom);

    const attempts = [
      await editAccount(
        { teamMemberId: id, name: "  ", username, role: "technician", newPassword: "" },
        { db, actor: tom },
      ),
      await editAccount(
        { teamMemberId: id, name: "Anna", username: "a b", role: "technician", newPassword: "" },
        { db, actor: tom },
      ),
    ];

    expect(attempts).toEqual([
      { ok: false, error: "name-required" },
      { ok: false, error: "username-invalid" },
    ]);
    expect(await stored(id)).toMatchObject({ name: "Anna Berger", username, role: "helper" });
  });

  it("keeps a username written in capitals as its normalised form, and its own username is not taken", async () => {
    const tom = await aTechnician();
    const { id, username, password } = await anna(tom);

    const outcome = await editAccount(
      {
        teamMemberId: id,
        name: "Anna Berger",
        username: ` ${username.toUpperCase()} `,
        role: "helper",
        newPassword: "",
      },
      { db, actor: tom },
    );

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await stored(id)).toMatchObject({ username });
    expect(await canLogIn(username, password)).toBe(true);
  });

  it("lets only technicians edit an account, and finds no account that does not exist", async () => {
    const tom = await aTechnician();
    const { id, username } = await anna(tom);
    const helper = { kind: "team-member", teamMemberId: id, role: "helper" } as const;
    const change = { name: "Anna Schmidt", username, role: "technician", newPassword: "" } as const;

    expect(await editAccount({ teamMemberId: id, ...change }, { db, actor: helper })).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect(await editAccount({ teamMemberId: randomUUID(), ...change }, { db, actor: tom })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await stored(id)).toMatchObject({ name: "Anna Berger", role: "helper" });
  });
});

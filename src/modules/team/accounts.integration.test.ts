import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { changeRole, createAccount, currentPerson, logIn } from ".";
import { aTeamMemberAccount, cookieHeader } from "./accounts.test-support";

const db = testDatabase();

function aUsername(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

/** A logged-in technician who manages the accounts of a test – other tests' technicians do not disturb it. */
async function aTechnician() {
  const username = aUsername("tom");
  const { id } = await aTeamMemberAccount(db, {
    name: "Tom",
    username,
    role: "technician",
    password: "tom-secret-10",
  });
  return { kind: "team-member", teamMemberId: id, role: "technician" } as const;
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

describe("managing team member accounts", () => {
  it("ST-005: Technician creates a helper account", async () => {
    const technician = await aTechnician();
    const username = aUsername("anna");

    const outcome = await createAccount(
      { name: "Anna Berger", username, password: "anna-secret-10", role: "helper" },
      { db, actor: technician },
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
      { db, actor: technician },
    );
    expect(taken.ok).toBe(true);

    const outcome = await createAccount(
      { name: "Anna Bauer", username, password: "other-secret-10", role: "helper" },
      { db, actor: technician },
    );

    expect(outcome).toEqual({ ok: false, error: "username-taken" });
  });

  it("ST-005: Technician changes a role", async () => {
    const technician = await aTechnician();
    const { id, username, password } = await anna(technician);
    const herPhone = await sessionOf(username, password);
    expect(await currentPerson({ db, headers: herPhone })).toMatchObject({ role: "helper" });

    const outcome = await changeRole({ teamMemberId: id, role: "technician" }, { db, actor: technician });

    expect(outcome).toEqual({ ok: true, teamMemberId: id });
    expect(await currentPerson({ db, headers: herPhone })).toEqual({
      kind: "team-member",
      teamMemberId: id,
      role: "technician",
    });
  });
});

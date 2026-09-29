import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { testDatabase } from "@/test-support/database";
import { createAccount, currentPerson, logIn } from ".";
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

async function personBehind(username: string, password: string) {
  const loggedIn = await logIn({ username, password }, { db });
  if (!loggedIn.ok) throw new Error(loggedIn.error);
  return currentPerson({ db, headers: new Headers({ cookie: cookieHeader(loggedIn.cookies) }) });
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
});

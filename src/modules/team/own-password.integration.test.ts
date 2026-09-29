import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { changeOwnPassword, createAccount, currentPerson, logIn } from ".";
import { aTeamMemberAccount, cookieHeader } from "./accounts.test-support";

const db = testDatabase();

async function sessionOf(username: string, password: string): Promise<Headers> {
  const loggedIn = await logIn({ username, password }, { db });
  if (!loggedIn.ok) throw new Error(loggedIn.error);
  return new Headers({ cookie: cookieHeader(loggedIn.cookies) });
}

/** Anna, logged in on her phone – with the password she was given. */
async function annaOnHerPhone() {
  const suffix = randomUUID().slice(0, 8);
  const technician = await aTeamMemberAccount(db, {
    name: "Tom",
    username: `tom_${suffix}`,
    role: "technician",
    password: "tom-secret-10",
  });
  const username = `anna_${suffix}`;
  const password = "anna-secret-10";
  const created = await createAccount(
    { name: "Anna Berger", username, password, role: "helper" },
    { db, actor: { kind: "team-member", teamMemberId: technician.id, role: "technician" } },
  );
  if (!created.ok) throw new Error(created.error);
  const headers = await sessionOf(username, password);
  const actor: Actor = { kind: "team-member", teamMemberId: created.teamMemberId, role: "helper" };
  return { id: created.teamMemberId, username, password, headers, actor };
}

describe("changing your own password", () => {
  it("ST-005: Team member changes their own password", async () => {
    const anna = await annaOnHerPhone();

    const herOtherPhone = await sessionOf(anna.username, anna.password);

    const outcome = await changeOwnPassword(
      { currentPassword: anna.password, newPassword: "anna-chose-this" },
      { db, actor: anna.actor, headers: anna.headers },
    );

    expect(outcome).toEqual({ ok: true, teamMemberId: anna.id });
    // Changing your password logs your other devices out – the reason to change it is usually that it leaked.
    expect(await currentPerson({ db, headers: herOtherPhone })).toEqual({ kind: "visitor" });
    expect(await currentPerson({ db, headers: await sessionOf(anna.username, "anna-chose-this") })).toMatchObject({
      teamMemberId: anna.id,
    });
    expect(await logIn({ username: anna.username, password: anna.password }, { db })).toEqual({
      ok: false,
      error: "login-failed",
    });
  });

  it("ST-005: Own password change needs the current password", async () => {
    const anna = await annaOnHerPhone();

    const outcome = await changeOwnPassword(
      { currentPassword: "not-her-password", newPassword: "anna-chose-this" },
      { db, actor: anna.actor, headers: anna.headers },
    );

    expect(outcome).toEqual({ ok: false, error: "current-password-wrong" });
    expect(await currentPerson({ db, headers: await sessionOf(anna.username, anna.password) })).toMatchObject({
      teamMemberId: anna.id,
    });
  });
});

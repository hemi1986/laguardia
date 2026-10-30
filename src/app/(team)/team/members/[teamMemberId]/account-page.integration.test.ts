import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deactivateAccount, editAccount, logIn, teamMemberAccount, teamMemberAccounts } from "@/modules/team";
import { aTeamMemberAccount } from "@/modules/team/accounts.test-support";
import { testDatabase } from "@/test-support/database";
import { AccountView } from "./account-view";
import { EditAccountView } from "./bearbeiten/edit-account-view";

/**
 * One team member's page and their account edit page (ST-081, ST-088): Team's account with the actions it offers to
 * the technician looking at it, rendered by the pages' views. Other tests' technicians stay active in the shared test
 * database, so no account here is the last active technician's.
 */
const db = testDatabase();

async function anAccount(name: string, role: "helper" | "technician") {
  const username = `${name.split(" ")[0].toLowerCase()}_${randomUUID().slice(0, 8)}`;
  const { id } = await aTeamMemberAccount(db, { name, username, role, password: "secret-password-10" });
  return { id, username };
}

async function aTechnician(name = "Eva Roth") {
  const { id } = await anAccount(name, "technician");
  return { kind: "team-member", teamMemberId: id, role: "technician" } as const;
}

/** The team member's page and their edit page, as the technician `viewerId` sees them. */
async function pages(teamMemberId: string, viewerId: string) {
  const account = await teamMemberAccount(db, teamMemberId, viewerId);
  if (!account) throw new Error("no account");
  return {
    page: renderToStaticMarkup(createElement(AccountView, { account })),
    editPage: renderToStaticMarkup(createElement(EditAccountView, { account })),
  };
}

describe("one team member's page and their edit page", () => {
  it("ST-088: The team member's page and the edit page show the account", async () => {
    const anna = await anAccount("Anna Berger", "helper");
    const eva = await aTechnician();

    const { page, editPage } = await pages(anna.id, eva.teamMemberId);

    expect(page).toContain("<h1");
    expect(page).toContain("Anna Berger");
    expect(page).toContain(anna.username);
    expect(page).toContain("Helfer:in");
    expect(page).toContain("Konto: aktiv");
    expect(page).toMatch(new RegExp(`<a [^>]*href="/team/members/${anna.id}/bearbeiten"[^>]*>Konto bearbeiten</a>`));
    expect(page).toMatch(/<button[^>]*>Konto deaktivieren<\/button>/);
    expect(page).not.toMatch(/<select|type="password"|Zu Techniker:in machen|Zu Helfer:in machen/);
    expect(page).not.toContain("/deaktivieren");

    expect(editPage).toMatch(/<h1[^>]*>Konto bearbeiten · Anna Berger<\/h1>/);
    expect(editPage).toMatch(/<input[^>]*name="name"[^>]*value="Anna Berger"/);
    expect(editPage).toMatch(new RegExp(`<input[^>]*name="username"[^>]*value="${anna.username}"`));
    expect(editPage).toMatch(/<option value="helper" selected="">Helfer:in<\/option>/);
    expect(editPage).toMatch(/<label[^>]*>Neues Passwort<\/label>/);
    expect(editPage).toMatch(/<input[^>]*name="newPassword"/);
    expect(editPage).not.toMatch(/<input[^>]*name="newPassword"[^>]*value=/);
    expect(editPage).toContain("Mindestens 10 Zeichen.");
    expect(editPage).toMatch(/<button[^>]*type="submit"[^>]*>Konto speichern<\/button>/);
    expect(editPage).toMatch(new RegExp(`<a [^>]*href="/team/members/${anna.id}"[^>]*>Zurück zum Teammitglied</a>`));
  });

  it("ST-088: One's own edit page fixes the role and has no new password", async () => {
    const tom = await aTechnician("Tom Keller");
    await aTechnician("Eva Roth");
    const own = (await teamMemberAccounts(db)).find((account) => account.id === tom.teamMemberId)!;

    const { editPage } = await pages(tom.teamMemberId, tom.teamMemberId);

    expect(editPage).toContain("Techniker:in");
    expect(editPage).toContain("Die eigene Rolle kann nur eine andere Techniker:in ändern.");
    expect(editPage).not.toContain("<select");
    expect(editPage).not.toContain("Neues Passwort");
    expect(editPage).not.toContain('name="newPassword"');
    expect(editPage).toMatch(/<a [^>]*href="\/team\/password"[^>]*>Passwort ändern<\/a>/);
    const edit = { teamMemberId: own.id, name: own.name, username: own.username, newPassword: "" };
    expect(await editAccount({ ...edit, role: "helper" }, { db, actor: tom })).toEqual({
      ok: false,
      error: "own-role",
    });
    expect(await editAccount({ ...edit, newPassword: "a-new-password-1" }, { db, actor: tom })).toEqual({
      ok: false,
      error: "own-password",
    });
    expect((await teamMemberAccounts(db)).find((account) => account.id === own.id)).toEqual(own);
    expect((await logIn({ username: own.username, password: "secret-password-10" }, { db })).ok).toBe(true);
  });

  it("ST-088: One's own page offers no deactivation", async () => {
    const tom = await aTechnician("Tom Keller");
    await aTechnician("Eva Roth");

    const { page } = await pages(tom.teamMemberId, tom.teamMemberId);

    expect(page).not.toContain("Konto deaktivieren");
    expect(page).toContain("Konto bearbeiten");
    expect(await deactivateAccount({ teamMemberId: tom.teamMemberId }, { db, actor: tom })).toEqual({
      ok: false,
      error: "own-deactivation",
    });
    expect((await teamMemberAccounts(db)).find((account) => account.id === tom.teamMemberId)).toMatchObject({
      active: true,
    });
  });

  it("ST-088: A deactivated account is not edited", async () => {
    const ben = await anAccount("Ben Weber", "helper");
    const eva = await aTechnician();
    const deactivated = await deactivateAccount({ teamMemberId: ben.id }, { db, actor: eva });
    if (!deactivated.ok) throw new Error(deactivated.error);

    const { page, editPage } = await pages(ben.id, eva.teamMemberId);

    expect(page.match(/<button/g)).toHaveLength(1);
    expect(page).toMatch(/<button[^>]*>Konto wieder aktivieren<\/button>/);
    expect(page).not.toContain("Konto bearbeiten");
    expect(page).not.toContain("Konto deaktivieren");
    expect(editPage).toContain("Dieses Konto ist deaktiviert.");
    expect(editPage).toMatch(new RegExp(`<a [^>]*href="/team/members/${ben.id}"[^>]*>Zurück zum Teammitglied</a>`));
    expect(editPage).not.toMatch(/<input|<select|<form/);
    const sentAnyway = { teamMemberId: ben.id, name: "Ben Schulz", username: ben.username, newPassword: "" };
    expect(await editAccount(sentAnyway, { db, actor: eva })).toEqual({ ok: false, error: "account-deactivated" });
    expect((await teamMemberAccounts(db)).find((account) => account.id === ben.id)).toMatchObject({
      name: "Ben Weber",
      active: false,
    });
  });

  it("ST-081: A deactivated account's page offers only activating it again", async () => {
    const ben = await anAccount("Ben Weber", "helper");
    const eva = await aTechnician();
    const deactivated = await deactivateAccount({ teamMemberId: ben.id }, { db, actor: eva });
    if (!deactivated.ok) throw new Error(deactivated.error);

    const { page: html } = await pages(ben.id, eva.teamMemberId);

    expect(html).toContain("Konto: deaktiviert");
    expect(html).toMatch(/<button[^>]*>Konto wieder aktivieren<\/button>/);
    expect(html).not.toContain("Zu Techniker:in machen");
    expect(html).not.toContain("Passwort zurücksetzen");
    expect(html).not.toContain("/deaktivieren");
  });
});

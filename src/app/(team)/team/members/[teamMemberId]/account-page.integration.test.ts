import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deactivateAccount, teamMemberAccount } from "@/modules/team";
import { aTeamMemberAccount } from "@/modules/team/accounts.test-support";
import { testDatabase } from "@/test-support/database";
import { AccountView } from "./account-view";

/**
 * One team member's page (ST-081): Team's account with the actions it offers, rendered by the page's view. Other
 * tests' technicians stay active in the shared test database, so no account here is the last active technician's.
 */
const db = testDatabase();

async function anAccount(name: string, role: "helper" | "technician") {
  const username = `${name.split(" ")[0].toLowerCase()}_${randomUUID().slice(0, 8)}`;
  const { id } = await aTeamMemberAccount(db, { name, username, role, password: "secret-password-10" });
  return { id, username };
}

const aTechnician = async () =>
  ({ kind: "team-member", teamMemberId: (await anAccount("Eva Roth", "technician")).id, role: "technician" }) as const;

async function rendered(teamMemberId: string): Promise<string> {
  const account = await teamMemberAccount(db, teamMemberId);
  if (!account) throw new Error("no account");
  return renderToStaticMarkup(createElement(AccountView, { account }));
}

describe("one team member's page", () => {
  it("ST-081: The actions of an account live on its own page", async () => {
    const anna = await anAccount("Anna Berger", "helper");

    const html = await rendered(anna.id);

    expect(html).toContain("Anna Berger");
    expect(html).toContain(anna.username);
    expect(html).toContain("Helfer:in");
    expect(html).toContain("Konto: aktiv");
    expect(html).toMatch(/<button[^>]*>Zu Techniker:in machen<\/button>/);
    expect(html).toMatch(/<button[^>]*>Passwort zurücksetzen<\/button>/);
    expect(html).toMatch(
      new RegExp(`<a [^>]*href="/team/members/${anna.id}/deaktivieren"[^>]*>Konto deaktivieren</a>`),
    );
    expect(html).not.toContain("Konto wieder aktivieren");
  });

  it("ST-081: A deactivated account's page offers only activating it again", async () => {
    const ben = await anAccount("Ben Weber", "helper");
    const deactivated = await deactivateAccount({ teamMemberId: ben.id }, { db, actor: await aTechnician() });
    if (!deactivated.ok) throw new Error(deactivated.error);

    const html = await rendered(ben.id);

    expect(html).toContain("Konto: deaktiviert");
    expect(html).toMatch(/<button[^>]*>Konto wieder aktivieren<\/button>/);
    expect(html).not.toContain("Zu Techniker:in machen");
    expect(html).not.toContain("Passwort zurücksetzen");
    expect(html).not.toContain("/deaktivieren");
  });
});

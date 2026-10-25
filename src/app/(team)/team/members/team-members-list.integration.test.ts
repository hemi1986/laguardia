import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { deactivateAccount, teamMemberAccounts } from "@/modules/team";
import type { Actor } from "@/platform/command";
import { aTeamMemberAccount } from "@/modules/team/accounts.test-support";
import { testDatabase } from "@/test-support/database";
import { TeamMembersList } from "./team-members-list";

/**
 * The team members page (ST-081): Team's accounts rendered by the list's view. The shared test database holds other
 * tests' accounts too, so each test tells its own team members apart by their usernames.
 */
const db = testDatabase();

async function anAccount(name: string, role: "helper" | "technician") {
  const username = `${name.split(" ")[0].toLowerCase()}_${randomUUID().slice(0, 8)}`;
  const { id } = await aTeamMemberAccount(db, { name, username, role, password: "secret-password-10" });
  return { id, username };
}

async function aDeactivatedAccount(name: string) {
  const account = await anAccount(name, "helper");
  const deactivated = await deactivateAccount({ teamMemberId: account.id }, { db, actor: await aTechnician() });
  if (!deactivated.ok) throw new Error(deactivated.error);
  return account;
}

async function aTechnician(): Promise<Actor> {
  const { id } = await anAccount("Eva Roth", "technician");
  return { kind: "team-member", teamMemberId: id, role: "technician" };
}

async function rendered(query: { deactivated?: boolean } = {}): Promise<string> {
  const accounts = await teamMemberAccounts(db, { includeDeactivated: query.deactivated ?? false });
  return renderToStaticMarkup(
    createElement(TeamMembersList, { accounts, deactivatedShown: query.deactivated ?? false }),
  );
}

/** The list entry of one team member – the `<li>` holding their username. */
function entryOf(html: string, username: string): string | undefined {
  return html.match(/<li\b[^>]*>(?:(?!<\/li>).)*<\/li>/gs)?.find((entry) => entry.includes(username));
}

/** The filter's checkbox for deactivated accounts. */
function filterOf(html: string): string {
  return html.match(/<input type="checkbox"[^>]*name="deaktivierte"[^>]*>/)![0];
}

describe("the team members page", () => {
  it("ST-081: The list shows one entry per team member", async () => {
    const anna = await anAccount("Anna Berger", "helper");
    const tom = await anAccount("Tom Keller", "technician");

    const html = await rendered();

    const annasEntry = entryOf(html, anna.username)!;
    const tomsEntry = entryOf(html, tom.username)!;
    expect(annasEntry).toContain("Anna Berger");
    expect(annasEntry).toContain("Helfer:in");
    expect(tomsEntry).toContain("Tom Keller");
    expect(tomsEntry).toContain("Techniker:in");
    for (const entry of [annasEntry, tomsEntry]) {
      expect(entry).not.toMatch(/<form|<button/);
      expect(entry).not.toContain("Deaktiviert");
    }
    expect(annasEntry).toContain(`href="/team/members/${anna.id}"`);
  });

  it("ST-081: Deactivated accounts are behind a filter", async () => {
    const anna = await anAccount("Anna Berger", "helper");
    const ben = await aDeactivatedAccount("Ben Weber");

    const html = await rendered();

    expect(entryOf(html, anna.username)).toBeDefined();
    expect(entryOf(html, ben.username)).toBeUndefined();
    expect(filterOf(html)).not.toContain("checked");
  });

  it("ST-081: The filter lists deactivated accounts, marked as such", async () => {
    const anna = await anAccount("Anna Berger", "helper");
    const ben = await aDeactivatedAccount("Ben Weber");

    const html = await rendered({ deactivated: true });

    expect(entryOf(html, anna.username)).not.toContain("Deaktiviert");
    expect(entryOf(html, ben.username)).toContain("Deaktiviert");
    expect(filterOf(html)).toContain("checked");
  });
});

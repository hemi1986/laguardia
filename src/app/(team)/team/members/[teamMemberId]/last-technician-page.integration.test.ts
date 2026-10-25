import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changeRole, deactivateAccount, teamMemberAccount } from "@/modules/team";
import { aTeamMemberAccount } from "@/modules/team/accounts.test-support";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { AccountView } from "./account-view";

/**
 * "The last active technician account" counts the technicians of the whole museum – which the shared test database
 * cannot hold still. So this page test runs in a database of its own, where Tom is the only technician.
 */
const isolated = isolatedTestDatabase("last_technician_page");
let db: NodePgDatabase;

beforeAll(async () => {
  db = await isolated.reset();
});

afterAll(() => isolated.close());

describe("the last active technician's page", () => {
  it("ST-081: The last active technician account offers neither deactivating nor the change to helper", async () => {
    const { id } = await aTeamMemberAccount(db, {
      name: "Tom Keller",
      username: "tom",
      role: "technician",
      password: "tom-secret-10",
    });
    await aTeamMemberAccount(db, { name: "Anna Berger", username: "anna", role: "helper", password: "anna-secret-10" });
    const tom = { kind: "team-member", teamMemberId: id, role: "technician" } as const;

    const account = await teamMemberAccount(db, id);
    const html = renderToStaticMarkup(createElement(AccountView, { account: account! }));

    expect(html).not.toContain("/deaktivieren");
    expect(html).not.toContain("Zu Helfer:in machen");
    expect(html).toContain("Mindestens ein aktives Konto einer Techniker:in muss bleiben");
    expect(html).toContain("Passwort zurücksetzen");
    expect(await deactivateAccount({ teamMemberId: id }, { db, actor: tom })).toEqual({
      ok: false,
      error: "last-technician",
    });
    expect(await changeRole({ teamMemberId: id, role: "helper" }, { db, actor: tom })).toEqual({
      ok: false,
      error: "last-technician",
    });
  });
});

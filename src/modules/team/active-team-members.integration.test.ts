import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { activeTeamMemberRole, activeTeamMembers, deactivateAccount } from ".";

/** Whom work can be given to (ST-026): the team members with an active account, and the role of one of them. */
const db = testDatabase();
const member = (role: "helper" | "technician") => ({ kind: "team-member", teamMemberId: randomUUID(), role }) as const;
const tom = member("technician");
const anna = member("helper");
const gone = member("helper");

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, gone, "Gone");
  const deactivated = await deactivateAccount({ teamMemberId: gone.teamMemberId }, { db, actor: tom });
  if (!deactivated.ok) throw new Error(deactivated.error);
});

describe("active team members", () => {
  it("lists who has an active account, by name, with their role – no deactivated account", async () => {
    const listed = await activeTeamMembers(db);

    // The shared database holds other tests' team members too.
    expect(listed).toContainEqual({ id: tom.teamMemberId, name: "Tom", role: "technician" });
    expect(listed).toContainEqual({ id: anna.teamMemberId, name: "Anna", role: "helper" });
    expect(listed.map(({ id }) => id)).not.toContain(gone.teamMemberId);
    const names = listed.map(({ name }) => name);
    expect(names.indexOf("Anna")).toBeLessThan(names.lastIndexOf("Tom"));
  });

  it("knows the role of an active team member only – by the ID as Team spells it", async () => {
    expect(await activeTeamMemberRole(db, tom.teamMemberId)).toBe("technician");
    expect(await activeTeamMemberRole(db, anna.teamMemberId)).toBe("helper");
    expect(await activeTeamMemberRole(db, gone.teamMemberId)).toBeUndefined();
    expect(await activeTeamMemberRole(db, randomUUID())).toBeUndefined();
    expect(await activeTeamMemberRole(db, anna.teamMemberId.toUpperCase())).toBeUndefined();
    expect(await activeTeamMemberRole(db, "not an ID")).toBeUndefined();
    expect(await activeTeamMemberRole(db, "")).toBeUndefined();
  });
});

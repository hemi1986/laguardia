import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aMaintenanceTaskIn } from "@/test-support/maintenance";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { maintenancePlanChangedBy } from ".";

const maintenanceTaskAddedBy = (db: NodePgDatabase, maintenanceTaskId: string, teamMemberId: string) =>
  maintenancePlanChangedBy(db, { maintenanceTaskId, change: "added" }, teamMemberId);

/**
 * Whether a technician just added a maintenance task (ST-040, G3, architecture review 2026-10-18): the latest change of
 * the maintenance plan – one aggregate for everyone, so a database of its own.
 */
const isolated = isolatedTestDatabase("maintenance_in_command");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

beforeAll(async () => {
  db = await isolated.reset();
  for (const member of [tom, eva]) await anExistingTeamMember(db, member);
});
afterAll(() => isolated.close());

async function added(actor: typeof tom) {
  return aMaintenanceTaskIn(db, {
    name: `Task ${randomUUID()}`,
    intervalMonths: 3,
    at: "2026-10-18T14:00:00Z",
    by: actor,
  });
}

describe("a maintenance task just added", () => {
  it("is confirmed to the technician who added it, until someone changes the plan again", async () => {
    const tomsTask = await added(tom);

    expect(await maintenanceTaskAddedBy(db, tomsTask, tom.teamMemberId)).toBe(true);
    expect(await maintenanceTaskAddedBy(db, tomsTask, eva.teamMemberId)).toBe(false);

    const evasTask = await added(eva);
    expect(await maintenanceTaskAddedBy(db, tomsTask, tom.teamMemberId)).toBe(false);
    expect(await maintenanceTaskAddedBy(db, evasTask, eva.teamMemberId)).toBe(true);
  });
});

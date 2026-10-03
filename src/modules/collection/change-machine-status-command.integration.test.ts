import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  changeMachineStatusCommand,
  createMachineModelCommand,
  machineRecord,
  registerMachineCommand,
  type MachineStatus,
} from ".";
import { withoutMachines } from "./machines.test-support";

/**
 * CMD-ChangeMachineStatus (ST-012) through the command layer, observed through the machine record and the journal.
 * In a database of its own, so "LG-042" can be arranged.
 */
const isolated = isolatedTestDatabase("change_machine_status");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const hanna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let machineModelId: string;

beforeAll(async () => {
  db = await isolated.reset();
  for (const member of [eva, tom, hanna]) await anExistingTeamMember(db, member);
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  machineModelId = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(museumNumber: string, machineStatus: MachineStatus = "playable") {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 2", machineStatus },
    { actor: eva, db, clock: fixedClock("2026-01-15T09:00:00Z"), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

const at = (instant: string) => ({ db, clock: fixedClock(instant), newId: randomUUID });

describe("CMD-ChangeMachineStatus", () => {
  it("ST-012: Technician changes the machine status", async () => {
    const machineId = await registered("LG-042");

    const outcome = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "limited", reason: "left flipper weak" },
      { actor: tom, ...at("2026-03-02T14:00:00Z") },
    );

    expect(outcome).toEqual({ ok: true, result: { museumNumber: "LG-042", machineStatus: "limited" } });
    const record = await machineRecord(db, "LG-042");
    expect(record?.machineStatus).toBe("limited");
    expect(record?.statusHistory[0]).toMatchObject({
      previousStatus: "playable",
      newStatus: "limited",
      reason: "left flipper weak",
      changedBy: tom.teamMemberId,
      changedAt: new Date("2026-03-02T14:00:00Z"),
    });
    const [, changed] = await journalOf(db, { machineId });
    // No free text in the journal: the reason lives only in the status history.
    expect(changed).toMatchObject({
      type: "EVT-MachineStatusChanged",
      actor: tom,
      aggregate: { type: "AGG-Machine", id: machineId },
    });
    expect(changed.data).toEqual({ previousStatus: "playable", newStatus: "limited" });
  });
});

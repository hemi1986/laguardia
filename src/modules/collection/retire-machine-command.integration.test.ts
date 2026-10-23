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
  retireMachineCommand,
} from ".";
import { withoutMachines } from "./machines.test-support";

/**
 * CMD-RetireMachine (ST-039) through Collection's command – without Repair's policies, which ADR 0010 adds in Repair –
 * observed through the machine record and the journal. In a database of its own, so "LG-013" can be arranged.
 */
const isolated = isolatedTestDatabase("retire_machine");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const hanna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let machineModelId: string;

beforeAll(async () => {
  db = await isolated.reset();
  for (const member of [eva, hanna]) await anExistingTeamMember(db, member);
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

const at = (instant: string) => ({ db, clock: fixedClock(instant), newId: randomUUID });

/** "LG-013", registered Playable and then set Out of order – its status history has two entries. */
async function outOfOrder() {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber: "LG-013", serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: eva, ...at("2026-01-15T09:00:00Z") },
  );
  if (!registered.ok) throw new Error(registered.error);
  const { machineId } = registered.result;
  const changed = await executeCommand(
    changeMachineStatusCommand,
    { machineId, version: 0, machineStatus: "out-of-order", reason: "Display dead" },
    { actor: eva, ...at("2026-02-01T10:00:00Z") },
  );
  if (!changed.ok) throw new Error(changed.error);
  return machineId;
}

const retire = (machineId: string, reason: string, actor: typeof eva | typeof hanna = eva, version = 1) =>
  executeCommand(retireMachineCommand, { machineId, version, reason }, { actor, ...at("2026-03-01T11:00:00Z") });

describe("CMD-RetireMachine", () => {
  it("ST-039: Technician retires a machine", async () => {
    const machineId = await outOfOrder();

    const outcome = await retire(machineId, "  Sold to a collector ");

    expect(outcome).toEqual({ ok: true, result: { machineId, museumNumber: "LG-013" } });
    const record = await machineRecord(db, "LG-013");
    expect(record?.retirement).toEqual({
      reason: "Sold to a collector",
      retiredBy: eva.teamMemberId,
      retiredAt: new Date("2026-03-01T11:00:00Z"),
    });
    // Its full history stays: the record still opens with both status history entries.
    expect(record?.statusHistory.map((change) => change.newStatus)).toEqual(["out-of-order", "playable"]);
    const [, , retired] = await journalOf(db, { machineId });
    // The reason is typed text – it stays in the aggregate (ST-003).
    expect(retired).toMatchObject({
      type: "EVT-MachineRetired",
      actor: eva,
      aggregate: { type: "AGG-Machine", id: machineId },
      data: {},
    });
  });

  it("a reason of blanks is no reason – the machine stays as it was", async () => {
    const machineId = await outOfOrder();

    expect(await retire(machineId, "   ")).toEqual({ ok: false, error: "reason-required" });
    expect((await machineRecord(db, "LG-013"))?.retirement).toBeUndefined();
  });

  it("ST-039: A retired machine cannot be retired again", async () => {
    const machineId = await outOfOrder();
    expect((await retire(machineId, "Sold to a collector")).ok).toBe(true);

    expect(await retire(machineId, "Sold twice", eva, 2)).toEqual({ ok: false, error: "machine-retired" });
    expect((await machineRecord(db, "LG-013"))?.retirement?.reason).toBe("Sold to a collector");
  });

  it("ST-039: Helpers cannot retire machines", async () => {
    const machineId = await outOfOrder();

    expect(await retire(machineId, "Sold to a collector", hanna)).toEqual({ ok: false, error: "not-authorized" });
    expect((await machineRecord(db, "LG-013"))?.retirement).toBeUndefined();
  });

  it("a retirement after a change the technician did not see is a conflict", async () => {
    const machineId = await outOfOrder();

    expect(await retire(machineId, "Sold to a collector", eva, 0)).toEqual({ ok: false, error: "version-conflict" });
  });
});

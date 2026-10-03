import { sql } from "drizzle-orm";
import { aggregateCommand, type Database } from "@/platform/command";
import { machines } from "./machines";
import type { MachineStatus } from "./register-machine";

/**
 * Test support for machines – only imported by tests. Empties the machine tables of an isolated test database
 * (`isolatedTestDatabase`), so a test can arrange "the highest museum number is LG-041". Never the shared one.
 */
export async function withoutMachines(db: Database): Promise<void> {
  const { rows } = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
  if (!/^laguardia_.+_test$/.test(rows[0].name) || rows[0].name === "laguardia_test") {
    throw new Error(`withoutMachines only empties an isolated test database, not "${rows[0].name}"`);
  }
  await db.execute(sql`TRUNCATE machine, museum_number, machine_status_change, problem_report CASCADE`);
}

/** Test stand-in for CMD-RetireMachine (ST-039): the machine is retired and leaves the active lists. */
export const retireMachineForTest = aggregateCommand({
  id: "CMD-TestRetireMachine",
  allowedActors: ["technician"],
  store: machines,
  target: (input: { machineId: string; version: number }) => ({ id: input.machineId, version: input.version }),
  decide: (machine, _input, { actor, clock }) => ({
    ok: true as const,
    state: { ...machine, retirement: { reason: "Sold", retiredBy: actor.teamMemberId, retiredAt: clock.now() } },
    events: [{ type: "EVT-TestMachineRetired" as const }],
  }),
  journal: (event, machine) => ({
    type: event.type,
    aggregate: { type: "AGG-Machine", id: machine.id },
    machineId: machine.id,
    data: {},
  }),
  result: () => ({}),
});

/** Test stand-in for CMD-CorrectMachineDetails (ST-035): a new museum number; the old one stays reserved (D11). */
export const correctMuseumNumberForTest = aggregateCommand({
  id: "CMD-TestCorrectMuseumNumber",
  allowedActors: ["technician"],
  store: machines,
  target: (input: { machineId: string; version: number; museumNumber: string }) => ({
    id: input.machineId,
    version: input.version,
  }),
  decide: (machine, input) => ({
    ok: true as const,
    state: { ...machine, museumNumber: input.museumNumber },
    events: [{ type: "EVT-TestMuseumNumberCorrected" as const }],
  }),
  journal: (event, machine) => ({
    type: event.type,
    aggregate: { type: "AGG-Machine", id: machine.id },
    machineId: machine.id,
    data: {},
  }),
  result: () => ({}),
});

/** A machine as stored – for checks at the command seam that no read model of that test's database shows. */
export async function storedMachine(db: Database, machineId: string) {
  return (await machines.load(db, machineId))?.state;
}

/** Test stand-in for CMD-ChangeMachineStatus (ST-010): a new machine status, appended to the status history. */
export const changeMachineStatusForTest = aggregateCommand({
  id: "CMD-TestChangeMachineStatus",
  allowedActors: ["technician"],
  store: machines,
  target: (input: { machineId: string; version: number; machineStatus: MachineStatus; reason?: string }) => ({
    id: input.machineId,
    version: input.version,
  }),
  decide: (machine, input, { actor, clock, newId }) => ({
    ok: true as const,
    state: {
      ...machine,
      machineStatus: input.machineStatus,
      statusHistory: [
        ...machine.statusHistory,
        {
          id: newId(),
          previousStatus: machine.machineStatus,
          newStatus: input.machineStatus,
          reason: input.reason ?? "Coil burnt",
          changedBy: actor.teamMemberId,
          changedAt: clock.now(),
        },
      ],
    },
    events: [{ type: "EVT-TestMachineStatusChanged" as const }],
  }),
  journal: (event, machine) => ({
    type: event.type,
    aggregate: { type: "AGG-Machine", id: machine.id },
    machineId: machine.id,
    data: {},
  }),
  result: () => ({}),
});

import { sql } from "drizzle-orm";
import { aggregateCommand, type Database } from "@/platform/command";
import { machines } from "./machines";

/**
 * Test support for machines – only imported by tests. Empties the machine tables of an isolated test database
 * (`isolatedTestDatabase`), so a test can arrange "the highest museum number is LG-041". Never the shared one.
 */
export async function withoutMachines(db: Database): Promise<void> {
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

/** A machine as stored – for details no read model shows yet (the serial number: machine record, ST-009). */
export async function storedMachine(db: Database, machineId: string) {
  return (await machines.load(db, machineId))?.state;
}

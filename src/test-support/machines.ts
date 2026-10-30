import { randomUUID } from "node:crypto";
import {
  changeMachineStatusCommand,
  createMachineModelCommand,
  machineForTeamForm,
  machineLabels,
  registerMachineCommand,
  type MachineStatus,
} from "@/modules/collection";
import { retireMachineCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Database } from "@/platform/command";
import { anExistingTeamMember, TEST_TECHNICIAN } from "./team-members";

/**
 * A registered machine for tests that need one to exist (a problem report refers to a registered machine, ST-007).
 * Set up through the commands (Q3): a machine model of its own and a machine with an assigned museum number,
 * registered with the given machine status (Playable unless a test is about another one).
 * Returns the MachineId.
 */
export async function aRegisteredMachine(db: Database, machineStatus: MachineStatus = "playable"): Promise<string> {
  const [machine] = await machinesOfOneModel(db, 1, machineStatus);
  return machine.machineId;
}

/**
 * Machines that share a machine model of their own – for what a machine model holds for all of them (its files,
 * ST-037, ST-054). Registered through the commands with assigned museum numbers; returns their IDs and numbers.
 */
export async function machinesOfOneModel(
  db: Database,
  count: number,
  machineStatus: MachineStatus = "playable",
): Promise<{ machineId: string; museumNumber: string }[]> {
  await anExistingTeamMember(db, TEST_TECHNICIAN);
  const dependencies = { actor: TEST_TECHNICIAN, db, newId: randomUUID };
  const model = await executeCommand(
    createMachineModelCommand,
    { title: `Test model ${randomUUID().slice(0, 8)}`, manufacturer: "Williams", machineCategory: "pinball" },
    dependencies,
  );
  if (!model.ok) throw new Error(model.error);
  const machines = [];
  for (let i = 0; i < count; i++) {
    const machine = await executeCommand(
      registerMachineCommand,
      {
        machineModelId: model.result.machineModelId,
        museumNumber: undefined,
        serialNumber: undefined,
        location: "Test hall",
        machineStatus,
      },
      dependencies,
    );
    if (!machine.ok) throw new Error(machine.error);
    machines.push(machine.result);
  }
  return machines;
}

/**
 * A machine retired – through the retirement of Repair, which closes what is open on it (ST-039). Retiring is a
 * technician's command; `retiredAt` is the instant it happened.
 */
export async function retireMachine(
  db: Database,
  machineId: string,
  retiredAt = "2026-10-15T10:00:00Z",
): Promise<void> {
  await anExistingTeamMember(db, TEST_TECHNICIAN);
  const label = (await machineLabels(db, [machineId])).get(machineId);
  const machine = label && (await machineForTeamForm(db, label.museumNumber));
  if (!machine) throw new Error(`no machine ${machineId}`);
  const retired = await executeCommand(
    retireMachineCommand,
    { machineId, version: machine.version, reason: "Sold to a collector" },
    { actor: TEST_TECHNICIAN, db, clock: fixedClock(retiredAt), newId: randomUUID },
  );
  if (!retired.ok) throw new Error(retired.error);
}

/**
 * The journal of a machine from `aRegisteredMachine` without its registration – what happened to the machine since.
 * Throws if the first entry is not the registration, so a test cannot silently drop anything else.
 */
export async function journalSinceRegistration(db: Database, machineId: string) {
  const [registration, ...since] = await journalOf(db, { machineId });
  if (registration?.type !== "EVT-MachineRegistered") throw new Error(`${machineId} was not registered first`);
  return since;
}

/**
 * The machine's status changed once at each of the instants, in that order, alternating between Out of order and
 * Playable (it starts from Playable) – for a status history of a given length (ST-093). Changing the status is a
 * technician's command; each change reads the version stored then.
 */
export async function statusChangedAt(
  db: Database,
  machineId: string,
  instants: readonly string[],
  by: typeof TEST_TECHNICIAN = TEST_TECHNICIAN,
): Promise<void> {
  await anExistingTeamMember(db, by);
  const label = (await machineLabels(db, [machineId])).get(machineId);
  if (!label) throw new Error(`no machine ${machineId}`);
  for (const [index, at] of instants.entries()) {
    const machine = await machineForTeamForm(db, label.museumNumber);
    if (!machine) throw new Error(`no machine ${machineId}`);
    const changed = await executeCommand(
      changeMachineStatusCommand,
      {
        machineId,
        version: machine.version,
        machineStatus: index % 2 === 0 ? "out-of-order" : "playable",
        reason: `Change ${index + 1}`,
      },
      { actor: by, db, clock: fixedClock(at), newId: randomUUID },
    );
    if (!changed.ok) throw new Error(changed.error);
  }
}

import { randomUUID } from "node:crypto";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { executeCommand, journalOf, type Actor, type Database } from "@/platform/command";
import { anExistingTeamMember } from "./team-members";

/**
 * A registered machine for tests that need one to exist (a problem report refers to a registered machine, ST-007).
 * Set up through the commands (Q3): a machine model of its own and a machine with an assigned museum number.
 * Returns the MachineId.
 */
export async function aRegisteredMachine(db: Database): Promise<string> {
  const technician: Actor = { kind: "team-member", teamMemberId: TEST_TECHNICIAN, role: "technician" };
  await anExistingTeamMember(db, technician);
  const dependencies = { actor: technician, db, newId: randomUUID };
  const model = await executeCommand(
    createMachineModelCommand,
    { title: `Test model ${randomUUID().slice(0, 8)}`, manufacturer: "Williams", machineCategory: "pinball" },
    dependencies,
  );
  if (!model.ok) throw new Error(model.error);
  const machine = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: model.result.machineModelId,
      museumNumber: undefined,
      serialNumber: undefined,
      location: "Test hall",
      machineStatus: "playable",
    },
    dependencies,
  );
  if (!machine.ok) throw new Error(machine.error);
  return machine.result.machineId;
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

const TEST_TECHNICIAN = "00000000-0000-4000-8000-00000000a007";

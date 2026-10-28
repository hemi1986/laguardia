import { randomUUID } from "node:crypto";
import { changeMaintenancePlanCommand, maintenancePlanVersion } from "@/modules/maintenance";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor, type Database } from "@/platform/command";
import { anExistingTeamMember, TEST_TECHNICIAN } from "./team-members";

/**
 * A maintenance task in the maintenance plan for tests that need one to exist (ST-040, ST-094): added through
 * CMD-ChangeMaintenancePlan at the plan's current version, applying to the given machines from `at` on (due there at
 * once, HS-24). `by` is the technician who added it – the test technician unless a test is about who did. Returns the
 * maintenance task's ID.
 */
export async function aMaintenanceTaskIn(
  db: Database,
  {
    name,
    machineIds = [],
    intervalMonths = 12,
    suitableForHelpers = false,
    instruction = `${name} – how to`,
    at = "2026-03-01T10:00:00Z",
    by,
  }: {
    name: string;
    machineIds?: readonly string[];
    intervalMonths?: number;
    suitableForHelpers?: boolean;
    instruction?: string;
    at?: string;
    by?: Actor;
  },
): Promise<string> {
  const actor = by ?? (await aTestTechnician(db));
  const added = await executeCommand(
    changeMaintenancePlanCommand,
    {
      version: await maintenancePlanVersion(db),
      change: "add",
      task: { name, instruction, intervalMonths, suitableForHelpers, machineIds },
    },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.maintenanceTaskId;
}

/** A maintenance task removed from the maintenance plan (ST-041) – at the plan's current version. */
export async function removeMaintenanceTaskIn(
  db: Database,
  maintenanceTaskId: string,
  { at = "2026-06-09T10:00:00Z", by }: { at?: string; by?: Actor } = {},
): Promise<void> {
  const actor = by ?? (await aTestTechnician(db));
  const removed = await executeCommand(
    changeMaintenancePlanCommand,
    { version: await maintenancePlanVersion(db), change: "remove", maintenanceTaskId },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!removed.ok) throw new Error(removed.error);
}

async function aTestTechnician(db: Database): Promise<Actor> {
  await anExistingTeamMember(db, TEST_TECHNICIAN);
  return TEST_TECHNICIAN;
}

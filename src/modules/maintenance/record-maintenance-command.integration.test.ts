import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aMaintenanceTaskIn, removeMaintenanceTaskIn } from "@/test-support/maintenance";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  changeMachineStatusCommand,
  createMachineModelCommand,
  machineForMaintenance,
  registerMachineCommand,
  type MachineStatus,
} from "@/modules/collection";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { reportProblemCommand, retireMachineCommand } from "@/modules/repair";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  dueMaintenance,
  maintenanceForRecording,
  maintenanceRecords,
  recordMaintenanceCommand,
  type MaintenanceOutcome,
} from ".";

/**
 * CMD-RecordMaintenance (ST-044) through the command layer: the maintenance record is stored with its facts read from
 * the maintenance plan and from Collection, journaled without its note, and only *done* restarts the interval. In a
 * database of its own: the maintenance plan is one aggregate, which ST-040's tests change in the shared database at the
 * same time. Every test has a machine and a maintenance task of its own.
 */
const isolated = isolatedTestDatabase("record_maintenance");
let db: NodePgDatabase;
let machineModelId: string;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tenthOfJune = fixedClock("2026-06-10T10:00:00Z");

/** A maintenance task of its own, applying to the given machines, added on 1 December 2025. */
async function aMaintenanceTask(name: string, machineIds: string[], intervalMonths = 1, suitableForHelpers = true) {
  return aMaintenanceTaskIn(db, {
    name: `${name} ${randomUUID()}`,
    machineIds,
    intervalMonths,
    suitableForHelpers,
    instruction: "As usual.",
    at: "2025-12-01T09:00:00Z",
    by: tom,
  });
}

function record(
  maintenanceTaskId: string,
  machineId: string,
  date: string | undefined,
  { outcome = "done", actor = tom }: { outcome?: MaintenanceOutcome; actor?: Actor } = {},
) {
  return executeCommand(
    recordMaintenanceCommand,
    { maintenanceTaskId, machineId, outcome, date, note: "" },
    { actor, db, clock: tenthOfJune, newId: randomUUID },
  );
}

/** When the maintenance task is due on the machine on that day – none when it is not due then. */
async function dueThatDay(day: string, maintenanceTaskId: string, machineId: string) {
  const due = await dueMaintenance(db, fixedClock(`${day}T10:00:00Z`));
  return due.find((task) => task.id === maintenanceTaskId)?.machines.find((machine) => machine.machineId === machineId);
}

/** A machine of its own – registered in 2025. */
async function aMachine(machineStatus: MachineStatus = "playable") {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber: undefined, serialNumber: undefined, location: "Hall 1", machineStatus },
    { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball", technology: "dmd" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!model.ok) throw new Error(model.error);
  machineModelId = model.result.machineModelId;
});

afterAll(() => isolated.close());

describe("CMD-RecordMaintenance", () => {
  it("ST-044: Back-dating up to 7 days", async () => {
    const lg042 = await aMachine();
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042]);

    const recorded = await record(cleanGlass, lg042, "2026-06-03");

    expect(recorded.ok).toBe(true);
    expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([
      expect.objectContaining({
        maintenanceTaskId: cleanGlass,
        outcome: "done",
        date: "2026-06-03",
        recordedBy: tom.teamMemberId,
      }),
    ]);
    // Next due one interval after the recorded date.
    expect(await dueThatDay("2026-07-02", cleanGlass, lg042)).toBeUndefined();
    expect(await dueThatDay("2026-07-03", cleanGlass, lg042)).toMatchObject({
      lastDone: "2026-06-03",
      dueSince: "2026-07-03",
    });
  });

  it("ST-094: Maintenance is recorded only on a machine the task applies to", async () => {
    const lg020 = await aMachine();
    const lg042 = await aMachine();
    const joysticks = await aMaintenanceTask("Test joysticks, buttons, coin door", [lg020]);

    expect(await record(joysticks, lg042, undefined)).toEqual({ ok: false, error: "maintenance-task-does-not-apply" });
    expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([]);

    expect((await record(joysticks, lg020, undefined)).ok).toBe(true);
    expect(await maintenanceRecords(db, { machineId: lg020 })).toHaveLength(1);
  });

  it("ST-044: Maintenance on a machine not on display counts", async () => {
    const lg030 = await aMachine("not-on-display");
    const cleanPlayfield = await aMaintenanceTask("Clean playfield", [lg030], 3);

    expect((await record(cleanPlayfield, lg030, undefined)).ok).toBe(true);

    expect(await maintenanceRecords(db, { machineId: lg030 })).toEqual([
      expect.objectContaining({ maintenanceTaskId: cleanPlayfield, outcome: "done", date: "2026-06-10" }),
    ]);
    // The interval counts from that day: back on display on 1 July, it is not due before 10 September. (A machine not
    // on display is never due – ST-056; brought back first, the test holds after it too.)
    const back = await executeCommand(
      changeMachineStatusCommand,
      { machineId: lg030, version: 0, machineStatus: "playable", reason: "Restoration finished" },
      { actor: tom, db, clock: fixedClock("2026-07-01T09:00:00Z"), newId: randomUUID },
    );
    if (!back.ok) throw new Error(back.error);
    expect(await dueThatDay("2026-09-09", cleanPlayfield, lg030)).toBeUndefined();
    expect(await dueThatDay("2026-09-10", cleanPlayfield, lg030)).toMatchObject({
      lastDone: "2026-06-10",
      dueSince: "2026-09-10",
    });
  });

  it("journals the maintenance record on its machine – never its note", async () => {
    const lg042 = await aMachine();
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042]);

    const recorded = await executeCommand(
      recordMaintenanceCommand,
      {
        maintenanceTaskId: cleanGlass,
        machineId: lg042,
        outcome: "partially-done",
        date: undefined,
        note: "Row 3 blocked by Anna",
      },
      { actor: tom, db, clock: tenthOfJune, newId: randomUUID },
    );
    if (!recorded.ok) throw new Error(recorded.error);

    const [entry] = (await journalOf(db, { machineId: lg042 })).filter((e) => e.type === "EVT-MaintenanceRecorded");
    expect(entry).toMatchObject({
      aggregate: { type: "AGG-MaintenanceRecord", id: recorded.result.maintenanceRecordId },
      machineId: lg042,
      actor: tom,
      data: { maintenanceTaskId: cleanGlass, outcome: "partially-done", date: "2026-06-10" },
    });
    expect(JSON.stringify(entry.data)).not.toContain("Anna");
  });

  it("is not for visitors, and rejects an unknown machine or maintenance task", async () => {
    const lg042 = await aMachine();
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042]);

    expect(await record(cleanGlass, lg042, undefined, { actor: { kind: "visitor" } })).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect(await record(cleanGlass, randomUUID(), undefined)).toEqual({ ok: false, error: "unknown-machine" });
    expect(await record("not-an-id", lg042, undefined)).toEqual({ ok: false, error: "maintenance-task-unknown" });
  });

  it("ST-039: Actions on a retired machine are rejected", async () => {
    const lg013 = await aMachine();
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg013]);
    const at = { actor: tom, db, clock: fixedClock("2026-06-01T09:00:00Z"), newId: randomUUID };
    const retired = await executeCommand(
      retireMachineCommand,
      { machineId: lg013, version: 0, reason: "Sold to a collector" },
      at,
    );
    if (!retired.ok) throw new Error(retired.error);

    // Maintenance reads from Collection whether the machine is retired – a retired machine gets no maintenance record.
    expect(await record(cleanGlass, lg013, undefined)).toEqual({ ok: false, error: "machine-retired" });
    expect(await maintenanceRecords(db, { machineId: lg013 })).toEqual([]);
    expect(await executeCommand(reportProblemCommand, { machineId: lg013, description: "Ball stuck" }, at)).toEqual({
      ok: false,
      error: "machine-retired",
    });
    expect(
      await executeCommand(
        changeMachineStatusCommand,
        { machineId: lg013, version: 1, machineStatus: "limited", reason: "Back again?" },
        at,
      ),
    ).toEqual({ ok: false, error: "machine-retired" });
    expect(await journalOf(db, { machineId: lg013 })).toHaveLength(2);
  });
});

describe("what Maintenance offers the team member who asks (G11)", () => {
  const anna = { role: "helper" } as const;

  it("says on each due machine whether they may record the task there – never when nobody asks", async () => {
    const lg042 = await aMachine();
    const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042], 1, false);
    const offered = async (teamMember?: { role: "helper" | "technician" }) =>
      (await dueMaintenance(db, tenthOfJune, teamMember))
        .find((task) => task.id === fuses)
        ?.machines.find((machine) => machine.machineId === lg042)?.recordOffered;

    expect(await offered(tom)).toBe(true);
    expect(await offered(anna)).toBe(false);
    expect(await offered()).toBe(false);
  });

  it("answers for one machine: the task, why it would refuse them, and the dates it accepts", async () => {
    const lg042 = await aMachine();
    const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042], 1, false);
    const machine = await machineForMaintenance(db, lg042);

    expect(await maintenanceForRecording(db, tenthOfJune, fuses, machine!, tom)).toEqual({
      maintenanceTask: { id: fuses, name: expect.stringContaining("Check fuses"), instruction: "As usual." },
      whyNot: undefined,
      today: "2026-06-10",
      earliest: "2026-06-03",
    });
    expect((await maintenanceForRecording(db, tenthOfJune, fuses, machine!, anna))?.whyNot).toBe(
      "maintenance-not-suitable-for-helpers",
    );
    expect(await maintenanceForRecording(db, tenthOfJune, randomUUID(), machine!, tom)).toBeUndefined();

    await removeMaintenanceTaskIn(db, fuses, { at: tenthOfJune.now().toISOString(), by: tom });
    expect(await maintenanceForRecording(db, tenthOfJune, fuses, machine!, tom)).toBeUndefined();
  });
});

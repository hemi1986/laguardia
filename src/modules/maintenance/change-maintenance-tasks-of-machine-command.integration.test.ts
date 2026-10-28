import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aMaintenanceTaskIn, removeMaintenanceTaskIn } from "@/test-support/maintenance";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aRegisteredMachine, retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  changeMachinesOfMaintenanceTaskCommand,
  changeMaintenanceTasksOfMachineCommand,
  dueMaintenance,
  maintenancePlan,
  maintenancePlanVersion,
  maintenanceRecords,
  recordMaintenanceCommand,
} from ".";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";

/**
 * CMD-ChangeMachinesOfMaintenanceTask from the machine record (ST-096): one machine, several maintenance tasks – one
 * `EVT-MachinesOfMaintenanceTaskChanged` per task that changed, all stored together or not at all. Like the change from a
 * task (ST-095) it carries what the technician changed – the tasks as ticked when the page opened (`seen`) and ticked now –
 * and runs without a version. In a database of its own: the maintenance plan is one aggregate.
 */
const isolated = isolatedTestDatabase("change_tasks_of_machine");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tenthOfJune = "2026-06-10T10:00:00Z";

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
});

afterAll(() => isolated.close());

/** A maintenance task of its own applying to the given machines from 1 March 2026. */
async function aTask(machineIds: string[], { name = "Wax playfield", intervalMonths = 12 } = {}) {
  return aMaintenanceTaskIn(db, {
    name: `${name} ${randomUUID()}`,
    machineIds,
    intervalMonths,
    suitableForHelpers: true,
    by: tom,
  });
}

async function removeTask(maintenanceTaskId: string) {
  await removeMaintenanceTaskIn(db, maintenanceTaskId, { at: tenthOfJune, by: eva });
}

function change(
  machineId: string,
  { seen, ticked }: { seen: string[]; ticked: string[] },
  { actor = tom as Actor, at = tenthOfJune } = {},
) {
  return executeCommand(
    changeMaintenanceTasksOfMachineCommand,
    { machineId, seen, ticked },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

async function changed(...args: Parameters<typeof change>) {
  const outcome = await change(...args);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome;
}

const dueThatDay = async (day: string, maintenanceTaskId: string, machineId: string) =>
  (await dueMaintenance(db, fixedClock(`${day}T10:00:00Z`)))
    .find((task) => task.id === maintenanceTaskId)
    ?.machines.find((machine) => machine.machineId === machineId);

const countOf = async (maintenanceTaskId: string) =>
  (await maintenancePlan(db)).maintenanceTasks.find((task) => task.id === maintenanceTaskId)?.machineCount;

/** What was journaled for the plan about the machines of that task. */
async function machineEvents(maintenanceTaskId: string) {
  return (await journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID })).filter(
    (entry) =>
      entry.type === "EVT-MachinesOfMaintenanceTaskChanged" && entry.data.maintenanceTaskId === maintenanceTaskId,
  );
}

describe("CMD-ChangeMachinesOfMaintenanceTask from the machine record", () => {
  it("ST-096: Several tasks changed at once, one change per task", async () => {
    const [lg042, lg043] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const cleanGlass = await aTask([lg042], { name: "Clean glass (inside & out)" });
    const waxPlayfield = await aTask([lg043], { name: "Wax playfield" });
    const untouched = await aTask([lg042], { name: "Switch test (every switch)" });
    const recorded = await executeCommand(
      recordMaintenanceCommand,
      { maintenanceTaskId: cleanGlass, machineId: lg042, outcome: "done", date: "2026-05-02", note: "" },
      { actor: tom, db, clock: fixedClock("2026-05-02T10:00:00Z"), newId: randomUUID },
    );
    expect(recorded).toMatchObject({ ok: true });
    const before = {
      cleanGlass: (await machineEvents(cleanGlass)).length,
      waxPlayfield: (await machineEvents(waxPlayfield)).length,
      untouched: (await machineEvents(untouched)).length,
    };

    await changed(lg042, { seen: [cleanGlass, untouched], ticked: [untouched, waxPlayfield] });

    // Clean glass no longer applies to LG-042, its maintenance records there stay.
    expect(await dueThatDay("2026-06-10", cleanGlass, lg042)).toBeUndefined();
    expect(
      (await maintenanceRecords(db, { machineId: lg042 })).filter((r) => r.maintenanceTaskId === cleanGlass),
    ).toHaveLength(1);
    // Wax playfield applies and is due there at once.
    expect(await dueThatDay("2026-06-10", waxPlayfield, lg042)).toMatchObject({ dueSince: "2026-06-10" });
    // Exactly one change of machines for each of the two tasks, none for the other.
    expect(await machineEvents(cleanGlass)).toHaveLength(before.cleanGlass + 1);
    expect(await machineEvents(waxPlayfield)).toHaveLength(before.waxPlayfield + 1);
    expect(await machineEvents(untouched)).toHaveLength(before.untouched);
    expect((await machineEvents(cleanGlass)).at(-1)).toMatchObject({
      actor: { teamMemberId: tom.teamMemberId },
      machineId: null,
      data: { machinesAdded: [], machinesRemoved: [lg042] },
    });
    expect((await machineEvents(waxPlayfield)).at(-1)?.data).toMatchObject({ machinesAdded: [lg042] });
  });

  it("ST-096: A form opened before another change does not undo it", async () => {
    const lg042 = await aRegisteredMachine(db);
    const waxPlayfield = await aTask([lg042], { name: "Wax playfield" });
    const cleanGlass = await aTask([], { name: "Clean glass (inside & out)" });
    // Tom opened the form: Wax playfield ticked. Eva then removed LG-042 from Wax playfield on the task's page.
    const seenByTom = [waxPlayfield];
    const removed = await executeCommand(
      changeMachinesOfMaintenanceTaskCommand,
      { maintenanceTaskId: waxPlayfield, seen: [lg042], ticked: [] },
      { actor: eva, db, clock: fixedClock(tenthOfJune), newId: randomUUID },
    );
    expect(removed).toMatchObject({ ok: true });

    // Tom ticks Clean glass, leaves Wax playfield ticked as it was, and saves.
    await changed(lg042, { seen: seenByTom, ticked: [waxPlayfield, cleanGlass] });

    expect(await dueThatDay("2026-06-10", cleanGlass, lg042)).toBeDefined();
    expect(await dueThatDay("2026-06-10", waxPlayfield, lg042)).toBeUndefined();
  });

  it("ST-096: An unknown maintenance task in a forged change rejects it", async () => {
    const lg042 = await aRegisteredMachine(db);
    const waxPlayfield = await aTask([], { name: "Wax playfield" });
    const eventsBefore = (await machineEvents(waxPlayfield)).length;

    const unknown = await change(lg042, { seen: [], ticked: [waxPlayfield, randomUUID()] });
    const notAnId = await change(lg042, { seen: [], ticked: [waxPlayfield, "not an id"] });

    expect(unknown).toEqual({ ok: false, error: "maintenance-task-unknown" });
    expect(notAnId).toEqual({ ok: false, error: "maintenance-task-unknown" });
    // Rejected as a whole: not even the task that is known was ticked.
    expect(await countOf(waxPlayfield)).toBe(0);
    expect(await machineEvents(waxPlayfield)).toHaveLength(eventsBefore);
  });

  it("ST-096: A machine not on display can get a task", async () => {
    const lg030 = await aRegisteredMachine(db, "not-on-display");
    const cleanPlayfield = await aTask([], { name: "Clean playfield" });

    await changed(lg030, { seen: [], ticked: [cleanPlayfield] });

    expect(await countOf(cleanPlayfield)).toBe(1);
    // It becomes due on its return (HS-20), not while it is Not on display.
    expect(await dueThatDay("2026-06-10", cleanPlayfield, lg030)).toBeUndefined();
  });

  it("a task removed meanwhile rejects the whole change", async () => {
    const lg042 = await aRegisteredMachine(db);
    const cleanGlass = await aTask([lg042], { name: "Clean glass (inside & out)" });
    const waxPlayfield = await aTask([], { name: "Wax playfield" });
    await removeTask(waxPlayfield);

    const outcome = await change(lg042, { seen: [cleanGlass], ticked: [waxPlayfield] });

    expect(outcome).toEqual({ ok: false, error: "maintenance-task-removed" });
    // Clean glass still applies: the untick was not stored either.
    expect(await dueThatDay("2026-06-10", cleanGlass, lg042)).toBeDefined();
  });

  it("a change that changes nothing records no event and leaves the version", async () => {
    const lg042 = await aRegisteredMachine(db);
    const cleanGlass = await aTask([lg042], { name: "Clean glass (inside & out)" });
    const version = await maintenancePlanVersion(db);
    const events = (await machineEvents(cleanGlass)).length;

    const outcome = await change(lg042, { seen: [cleanGlass], ticked: [cleanGlass] });

    expect(outcome).toMatchObject({ ok: true });
    expect(await machineEvents(cleanGlass)).toHaveLength(events);
    expect(await maintenancePlanVersion(db)).toBe(version);
  });

  it("a task someone else already added is no rejection", async () => {
    const lg042 = await aRegisteredMachine(db);
    const waxPlayfield = await aTask([lg042], { name: "Wax playfield" });
    const events = (await machineEvents(waxPlayfield)).length;

    const outcome = await change(lg042, { seen: [], ticked: [waxPlayfield] });

    expect(outcome).toMatchObject({ ok: true });
    expect(await machineEvents(waxPlayfield)).toHaveLength(events);
    expect(await countOf(waxPlayfield)).toBe(1);
  });

  it("a retired or unknown machine rejects the change, even an unchanged one", async () => {
    const lg013 = await aRegisteredMachine(db);
    const waxPlayfield = await aTask([lg013], { name: "Wax playfield" });
    await retireMachine(db, lg013);

    const retired = await change(lg013, { seen: [], ticked: [waxPlayfield] });
    const unchanged = await change(lg013, { seen: [waxPlayfield], ticked: [waxPlayfield] });
    const unknown = await change(randomUUID(), { seen: [], ticked: [waxPlayfield] });
    const notAnId = await change("not an id", { seen: [], ticked: [waxPlayfield] });

    expect(retired).toEqual({ ok: false, error: "machine-retired" });
    expect(unchanged).toEqual({ ok: false, error: "machine-retired" });
    expect(unknown).toEqual({ ok: false, error: "unknown-machine" });
    expect(notAnId).toEqual({ ok: false, error: "unknown-machine" });
  });

  it("only technicians change the maintenance tasks of a machine", async () => {
    const lg042 = await aRegisteredMachine(db);
    const waxPlayfield = await aTask([], { name: "Wax playfield" });
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, anna, "Anna");

    const helper = await change(lg042, { seen: [], ticked: [waxPlayfield] }, { actor: anna });
    const visitor = await change(lg042, { seen: [], ticked: [waxPlayfield] }, { actor: { kind: "visitor" } });

    expect(helper).toEqual({ ok: false, error: "not-authorized" });
    expect(visitor).toEqual({ ok: false, error: "not-authorized" });
    expect(await countOf(waxPlayfield)).toBe(0);
  });
});

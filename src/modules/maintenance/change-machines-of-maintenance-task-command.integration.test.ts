import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aRegisteredMachine, retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  changeMachinesOfMaintenanceTaskCommand,
  changeMaintenancePlanCommand,
  dueMaintenance,
  maintenancePlan,
  maintenancePlanVersion,
  maintenanceRecords,
  recordMaintenanceCommand,
} from ".";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";

/**
 * CMD-ChangeMachinesOfMaintenanceTask (ST-095) through the command layer: a technician adds machines to a maintenance
 * task and removes machines from it later. The command carries what the technician changed – the machines as they were
 * ticked when the page opened (`seen`) and ticked now – so it runs without a version and two changes both stand. In a
 * database of its own: the maintenance plan is one aggregate, which other tests change in the shared database.
 */
const isolated = isolatedTestDatabase("change_machines_of_task");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const tenthOfJune = "2026-06-10T10:00:00Z";

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
});

afterAll(() => isolated.close());

/** A maintenance task of its own applying to the given machines from `addedAt` – 1 March 2026 unless said otherwise. */
async function aTask(
  machineIds: string[],
  { name = "Wax playfield", intervalMonths = 12, addedAt = "2026-03-01T10:00:00Z" } = {},
) {
  const added = await executeCommand(
    changeMaintenancePlanCommand,
    {
      version: await maintenancePlanVersion(db),
      change: "add",
      task: {
        name: `${name} ${randomUUID()}`,
        instruction: "As usual.",
        intervalMonths,
        suitableForHelpers: true,
        machineIds,
      },
    },
    { actor: tom, db, clock: fixedClock(addedAt), newId: randomUUID },
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.maintenanceTaskId;
}

type Change = { seen: string[]; ticked: string[] };

function change(
  maintenanceTaskId: string,
  { seen, ticked }: Change,
  { actor = tom as Actor, at = tenthOfJune }: { actor?: Actor; at?: string } = {},
) {
  return executeCommand(
    changeMachinesOfMaintenanceTaskCommand,
    { maintenanceTaskId, seen, ticked },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

/** The change succeeded. */
async function changed(...args: Parameters<typeof change>) {
  const outcome = await change(...args);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome;
}

const dueThatDay = async (day: string, maintenanceTaskId: string, machineId: string) =>
  (await dueMaintenance(db, fixedClock(`${day}T10:00:00Z`)))
    .find((task) => task.id === maintenanceTaskId)
    ?.machines.find((machine) => machine.machineId === machineId);

/** The machines the task applies to now (retired ones do not count), as the plan lists their number. */
const countOf = async (maintenanceTaskId: string) =>
  (await maintenancePlan(db)).maintenanceTasks.find((task) => task.id === maintenanceTaskId)?.machineCount;

/** What was journaled for the plan about the machines of that task. */
async function machineEvents(maintenanceTaskId: string) {
  return (await journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID })).filter(
    (entry) =>
      entry.type === "EVT-MachinesOfMaintenanceTaskChanged" && entry.data.maintenanceTaskId === maintenanceTaskId,
  );
}

async function record(maintenanceTaskId: string, machineId: string, date: string, at: string) {
  const recorded = await executeCommand(
    recordMaintenanceCommand,
    { maintenanceTaskId, machineId, outcome: "done", date, note: "" },
    { actor: tom, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!recorded.ok) throw new Error(recorded.error);
}

describe("CMD-ChangeMachinesOfMaintenanceTask", () => {
  it("adds a machine to a task, due at once from that day, journaled by machine ID", async () => {
    const [lg005, lg042, lg043] = [
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
    ];
    const task = await aTask([lg005, lg042]);

    const outcome = await change(task, { seen: [lg005, lg042], ticked: [lg005, lg042, lg043] });

    expect(outcome).toMatchObject({ ok: true });
    expect(await countOf(task)).toBe(3);
    // Due at once on the machine added, since the day it was added.
    expect(await dueThatDay("2026-06-10", task, lg043)).toMatchObject({ dueSince: "2026-06-10" });
    // The journal names the machines added by ID – no text, and no single machine of its own.
    const [entry] = (await machineEvents(task)).slice(-1);
    expect(entry).toMatchObject({
      actor: { teamMemberId: tom.teamMemberId },
      machineId: null,
      data: { maintenanceTaskId: task, machinesAdded: [lg043], machinesRemoved: [] },
    });
  });

  it("ST-095: A removed machine is no longer due and keeps its records", async () => {
    const [lg042, lg005] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005, lg042], { intervalMonths: 1, addedAt: "2026-01-01T10:00:00Z" });
    await record(task, lg042, "2026-02-03", "2026-02-03T10:00:00Z");
    await record(task, lg042, "2026-03-04", "2026-03-04T10:00:00Z");
    expect(await dueThatDay("2026-06-10", task, lg042)).toBeDefined();

    await changed(task, { seen: [lg005, lg042], ticked: [lg005] });

    expect(await dueThatDay("2026-06-10", task, lg042)).toBeUndefined();
    expect(await dueThatDay("2026-06-10", task, lg005)).toBeDefined();
    expect(
      (await maintenanceRecords(db, { machineId: lg042 })).filter((each) => each.maintenanceTaskId === task),
    ).toHaveLength(2);
    const [entry] = (await machineEvents(task)).slice(-1);
    expect(entry.data).toMatchObject({ machinesAdded: [], machinesRemoved: [lg042] });
  });

  it("ST-095: A machine added again is due at once", async () => {
    const lg042 = await aRegisteredMachine(db);
    const task = await aTask([lg042], { intervalMonths: 12, addedAt: "2026-01-01T10:00:00Z" });
    await record(task, lg042, "2026-03-01", "2026-03-01T10:00:00Z");
    await changed(task, { seen: [lg042], ticked: [] }, { at: "2026-04-01T10:00:00Z" });

    await changed(task, { seen: [], ticked: [lg042] }, { at: tenthOfJune });

    expect(await dueThatDay("2026-06-10", task, lg042)).toMatchObject({ dueSince: "2026-06-10", lastDone: undefined });
    expect(await countOf(task)).toBe(1);
  });

  it("ST-095: A done record backdated to before adding still counts", async () => {
    const [lg005, lg043] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005], { name: "Clean glass (inside & out)", intervalMonths: 1 });
    await changed(task, { seen: [lg005], ticked: [lg005, lg043] }, { at: tenthOfJune });

    await record(task, lg043, "2026-06-05", tenthOfJune);

    // Done on 5 June, one month interval: next due on 5 July.
    expect(await dueThatDay("2026-07-04", task, lg043)).toBeUndefined();
    expect(await dueThatDay("2026-07-05", task, lg043)).toMatchObject({
      lastDone: "2026-06-05",
      dueSince: "2026-07-05",
    });
  });

  it("ST-095: Two changes sent at the same time are both stored", async () => {
    const [lg005, lg042, lg043] = [
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
    ];
    const task = await aTask([lg005]);

    const [toms, evas] = await Promise.all([
      change(task, { seen: [lg005], ticked: [lg005, lg042] }, { actor: tom }),
      change(task, { seen: [lg005], ticked: [lg005, lg043] }, { actor: eva }),
    ]);

    expect(toms).toMatchObject({ ok: true });
    expect(evas).toMatchObject({ ok: true });
    expect(await countOf(task)).toBe(3);
    for (const machineId of [lg005, lg042, lg043])
      expect(await dueThatDay("2026-06-10", task, machineId)).toBeDefined();
  });

  it("ST-095: Adding a machine someone else already added is no rejection", async () => {
    const [lg005, lg043] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005], { name: "Wax playfield" });
    await changed(task, { seen: [lg005], ticked: [lg005, lg043] }, { actor: eva, at: "2026-06-09T10:00:00Z" });

    const eventsBefore = (await machineEvents(task)).length;

    const toms = await change(task, { seen: [lg005], ticked: [lg005, lg043] }, { actor: tom, at: tenthOfJune });

    expect(toms).toMatchObject({ ok: true });
    expect(await countOf(task)).toBe(2);
    // Its due date stays the one of Eva's change, and Tom's change records nothing.
    expect(await dueThatDay("2026-06-10", task, lg043)).toMatchObject({ dueSince: "2026-06-09" });
    expect(await machineEvents(task)).toHaveLength(eventsBefore);
  });

  it("ST-095: A retired machine stays among the machines when others change", async () => {
    const [lg005, lg013, lg042] = [
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
    ];
    const task = await aTask([lg005, lg013], { name: "Wax playfield" });
    await retireMachine(db, lg013);

    // The form did not list LG-013, so it was neither seen nor ticked.
    await changed(task, { seen: [lg005], ticked: [lg005, lg042] });

    expect(await countOf(task)).toBe(2);
    expect(await dueThatDay("2026-06-10", task, lg013)).toBeUndefined();
    const [entry] = (await machineEvents(task)).slice(-1);
    expect(entry.data).toMatchObject({ machinesAdded: [lg042], machinesRemoved: [] });
  });

  it("a machine retired after it was seen stays among the machines on a retry", async () => {
    const [lg005, lg042, lg043] = [
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
      await aRegisteredMachine(db),
    ];
    const task = await aTask([lg005, lg042]);
    await retireMachine(db, lg042);

    // The retry still names LG-042 as seen, but the page no longer offers it – so it is not ticked.
    await changed(task, { seen: [lg005, lg042], ticked: [lg005, lg043] });

    expect(await countOf(task)).toBe(2); // LG-005 and LG-043; the retired LG-042 is still among the machines
    const [entry] = (await machineEvents(task)).slice(-1);
    expect(entry.data).toMatchObject({ machinesAdded: [lg043], machinesRemoved: [] });
  });

  it("a machine already among the machines needs no check when someone ticks it", async () => {
    const [lg005, lg043] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005]);
    await changed(task, { seen: [lg005], ticked: [lg005, lg043] }, { actor: eva });
    await retireMachine(db, lg043);

    const toms = await change(task, { seen: [lg005], ticked: [lg005, lg043] });

    expect(toms).toMatchObject({ ok: true });
  });

  it("a machine retired meanwhile rejects the whole change", async () => {
    const [lg043, lg044] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([], { name: "Clean glass (inside & out)" });
    await retireMachine(db, lg044);

    const outcome = await change(task, { seen: [], ticked: [lg043, lg044] });

    expect(outcome).toEqual({ ok: false, error: "machine-retired" });
    expect(await countOf(task)).toBe(0);
    expect(await machineEvents(task)).toHaveLength(0);
  });

  it("ST-095: An unknown machine in a forged change rejects it", async () => {
    const [lg005, lg042] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005]);
    const eventsBefore = (await machineEvents(task)).length;

    const unknown = await change(task, { seen: [lg005], ticked: [lg005, lg042, randomUUID()] });
    const notAnId = await change(task, { seen: [lg005], ticked: [lg005, "not-an-id"] });
    const twice = await change(task, { seen: [lg005], ticked: [lg005, lg042, lg042] });

    expect(unknown).toEqual({ ok: false, error: "unknown-machine" });
    expect(notAnId).toEqual({ ok: false, error: "unknown-machine" });
    expect(twice).toEqual({ ok: false, error: "machine-chosen-twice" });
    // Rejected as a whole: not even the machine that is known was added.
    expect(await countOf(task)).toBe(1);
    expect(await machineEvents(task)).toHaveLength(eventsBefore);
  });

  it("a change that changes nothing records no event and leaves version and due dates", async () => {
    const [lg005, lg042] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005, lg042], { name: "Clean glass (inside & out)" });
    const version = await maintenancePlanVersion(db);
    const dueBefore = await dueThatDay("2026-06-10", task, lg005);

    const outcome = await change(task, { seen: [lg005, lg042], ticked: [lg005, lg042] });

    expect(outcome).toMatchObject({ ok: true });
    expect(await machineEvents(task)).toHaveLength(1); // only the one of adding the task with its machines
    expect(await maintenancePlanVersion(db)).toBe(version);
    expect(await dueThatDay("2026-06-10", task, lg005)).toEqual(dueBefore);
    expect(await countOf(task)).toBe(2);
  });

  it("removing every machine leaves the task for no machine", async () => {
    const lg090 = await aRegisteredMachine(db);
    const task = await aTask([lg090], { name: "Oil the gum machine" });

    await changed(task, { seen: [lg090], ticked: [] });

    expect(await countOf(task)).toBe(0);
    expect(await dueThatDay("2026-06-10", task, lg090)).toBeUndefined();
  });

  it("ST-095: The machines of a removed task never change", async () => {
    const [lg005, lg042] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005]);
    const removed = await executeCommand(
      changeMaintenancePlanCommand,
      { version: await maintenancePlanVersion(db), change: "remove", maintenanceTaskId: task },
      { actor: tom, db, clock: fixedClock(tenthOfJune), newId: randomUUID },
    );
    expect(removed).toMatchObject({ ok: true });
    const eventsBefore = (await machineEvents(task)).length;

    const outcome = await change(task, { seen: [lg005], ticked: [lg042] });

    expect(outcome).toEqual({ ok: false, error: "maintenance-task-unknown" });
    expect(await machineEvents(task)).toHaveLength(eventsBefore);
  });

  // „Geräte ändern“ not being offered to a helper is the page's access check: `e2e/maintenance-plan-machines.spec.ts`.
  it("ST-095: Helpers cannot change the machines of a task", async () => {
    const [lg005, lg042] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const task = await aTask([lg005], { name: "Clean glass (inside & out)" });

    const outcome = await change(task, { seen: [lg005], ticked: [lg005, lg042] }, { actor: anna });
    const visitor = await change(task, { seen: [lg005], ticked: [lg005, lg042] }, { actor: { kind: "visitor" } });

    expect(outcome).toEqual({ ok: false, error: "not-authorized" });
    expect(visitor).toEqual({ ok: false, error: "not-authorized" });
    expect(await countOf(task)).toBe(1);
  });
});

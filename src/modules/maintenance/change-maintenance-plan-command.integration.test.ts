import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aRegisteredMachine, retireMachine } from "@/test-support/machines";
import {
  changeMaintenancePlanCommand,
  dueMaintenance,
  maintenancePlan,
  type ChangeMaintenancePlanInput,
  type MaintenanceTaskDetails,
  type NewMaintenanceTask,
} from ".";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";

/**
 * CMD-ChangeMaintenancePlan (ST-040) through the command layer: a technician adds a maintenance task to the one
 * museum-wide maintenance plan, observed through RM-MaintenancePlan and the journal. Every test adds to the same plan
 * – it reads the version it changes, and finds its own maintenance task by a name no other test uses.
 */
const db = testDatabase();

/** One kind of change of the plan, without the version – the test reads the version stored now. */
type ChangeOf<Change extends ChangeMaintenancePlanInput["change"]> = Omit<
  Extract<ChangeMaintenancePlanInput, { change: Change }>,
  "version"
>;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

const aTask = (overrides: Partial<NewMaintenanceTask>): NewMaintenanceTask => ({
  name: `Task ${randomUUID()}`,
  instruction: "Do it carefully.",
  intervalMonths: 3,
  suitableForHelpers: false,
  machineIds: [],
  ...overrides,
});

async function add(task: NewMaintenanceTask, actor: Actor = tom) {
  const { version } = await maintenancePlan(db);
  return executeCommand(
    changeMaintenancePlanCommand,
    { version, change: "add", task },
    { actor, db, clock: fixedClock("2026-10-15T10:00:00Z"), newId: randomUUID },
  );
}

/** The maintenance task of that name in the maintenance plan as it is now. */
const listed = async (name: string) => (await maintenancePlan(db)).maintenanceTasks.find((task) => task.name === name);

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("CMD-ChangeMaintenancePlan – adding a maintenance task", () => {
  it("ST-094: A technician adds a maintenance task with its machines", async () => {
    const name = `Clean glass (inside & out) ${randomUUID()}`;
    const [lg005, lg042, lg020] = [await aRegisteredMachine(db), await aRegisteredMachine(db), await aRegisteredMachine(db)];

    const added = await add(
      aTask({
        name,
        instruction: "Glass out, clean both sides.",
        intervalMonths: 1,
        suitableForHelpers: true,
        machineIds: [lg005, lg042],
      }),
    );

    const task = await listed(name);
    expect(added).toEqual({ ok: true, result: { maintenanceTaskId: task?.id } });
    expect(task).toMatchObject({
      name,
      instruction: "Glass out, clean both sides.",
      intervalMonths: 1,
      suitableForHelpers: true,
      machineCount: 2,
    });
    // It applies to the two chosen machines and not to the third: it is due at once on those only.
    const dueOn = (await dueMaintenance(db, fixedClock("2026-10-15T10:00:00Z"))).find((due) => due.id === task?.id);
    expect(dueOn?.machines.map((machine) => machine.machineId).sort()).toEqual([lg005, lg042].sort());
    expect(dueOn?.machines.map((machine) => machine.machineId)).not.toContain(lg020);
    const entries = (await journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID })).filter(
      (candidate) => candidate.data.maintenanceTaskId === task?.id,
    );
    // Both events of the one step; only references and non-personal facts – the name and the instruction are typed text.
    expect(entries.map((entry) => entry.type)).toEqual(["EVT-MaintenancePlanChanged", "EVT-MachinesOfMaintenanceTaskChanged"]);
    expect(entries[0]).toMatchObject({ actor: tom, data: { maintenanceTaskId: task?.id, change: "added" } });
    expect(entries[1]).toMatchObject({
      actor: tom,
      machineId: null,
      data: { maintenanceTaskId: task?.id, machinesAdded: [lg005, lg042], machinesRemoved: [] },
    });
    expect(JSON.stringify(entries)).not.toContain("Glass out");
  });

  it("ST-094: A task for no machine", async () => {
    const name = `Oil the gum machine ${randomUUID()}`;
    await aRegisteredMachine(db);

    expect((await add(aTask({ name, machineIds: [] }))).ok).toBe(true);

    const task = await listed(name);
    expect(task).toMatchObject({ machineCount: 0 });
    expect((await dueMaintenance(db, fixedClock("2026-10-15T10:00:00Z"))).find((due) => due.id === task?.id)).toBeUndefined();
    const entries = (await journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID })).filter(
      (candidate) => candidate.data.maintenanceTaskId === task?.id,
    );
    // Nothing was added to the task: no event for its machines.
    expect(entries.map((entry) => entry.type)).toEqual(["EVT-MaintenancePlanChanged"]);
  });

  it("rejects a non-positive interval and stores nothing", async () => {
    const name = `Wax the playfield ${randomUUID()}`;
    const machineId = await aRegisteredMachine(db);
    const { version } = await maintenancePlan(db);

    expect(await add(aTask({ name, intervalMonths: 0, machineIds: [machineId] }))).toEqual({
      ok: false,
      error: "interval-not-positive",
    });

    expect(await listed(name)).toBeUndefined();
    expect((await maintenancePlan(db)).version).toBe(version);
  });

  it("rejects the whole step when a chosen machine was retired meanwhile", async () => {
    const name = `Wax the playfield ${randomUUID()}`;
    const [lg005, lg044] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const { version } = await maintenancePlan(db);
    await retireMachine(db, lg044);

    expect(await add(aTask({ name, machineIds: [lg005, lg044] }))).toEqual({ ok: false, error: "machine-retired" });

    // Neither the task nor any of its machines is stored, and the plan stays at its version.
    expect(await listed(name)).toBeUndefined();
    expect((await maintenancePlan(db)).version).toBe(version);
  });

  it("rejects the whole step for an unknown or doubled machine", async () => {
    const name = `Wax the playfield ${randomUUID()}`;
    const lg005 = await aRegisteredMachine(db);
    const { version } = await maintenancePlan(db);

    expect(await add(aTask({ name, machineIds: [lg005, randomUUID()] }))).toEqual({ ok: false, error: "unknown-machine" });
    expect(await add(aTask({ name, machineIds: [lg005, "not-an-id"] }))).toEqual({ ok: false, error: "unknown-machine" });
    expect(await add(aTask({ name, machineIds: [lg005, lg005] }))).toEqual({ ok: false, error: "machine-chosen-twice" });

    expect(await listed(name)).toBeUndefined();
    expect((await maintenancePlan(db)).version).toBe(version);
  });

  it("ST-040: Helpers cannot change the maintenance plan", async () => {
    const name = `Wax the playfield ${randomUUID()}`;
    const { version } = await maintenancePlan(db);

    expect(await add(aTask({ name }), anna)).toEqual({ ok: false, error: "not-authorized" });

    expect(await listed(name)).toBeUndefined();
    expect((await maintenancePlan(db)).version).toBe(version);
  });

  it("ST-094: Helpers cannot add maintenance tasks", async () => {
    const name = `Wax the playfield ${randomUUID()}`;
    const machineId = await aRegisteredMachine(db);
    const { version } = await maintenancePlan(db);

    expect(await add(aTask({ name, machineIds: [machineId] }), anna)).toEqual({ ok: false, error: "not-authorized" });

    expect(await listed(name)).toBeUndefined();
    expect((await maintenancePlan(db)).version).toBe(version);
  });

  it("keeps a task the technician saw an older plan for out – someone else changed the plan meanwhile", async () => {
    const { version } = await maintenancePlan(db);
    expect((await add(aTask({}))).ok).toBe(true);
    const name = `Late ${randomUUID()}`;

    const late = await executeCommand(
      changeMaintenancePlanCommand,
      { version, change: "add", task: aTask({ name }) },
      { actor: tom, db, clock: fixedClock("2026-10-15T10:00:00Z"), newId: randomUUID },
    );

    expect(late).toEqual({ ok: false, error: "version-conflict" });
    expect(await listed(name)).toBeUndefined();
  });
});

describe("CMD-ChangeMaintenancePlan – changing and removing a maintenance task (ST-041)", () => {
  /** Runs a change of the plan at the version stored now. */
  async function change(input: ChangeOf<"change"> | ChangeOf<"remove">, actor: Actor = tom) {
    const { version } = await maintenancePlan(db);
    return executeCommand(
      changeMaintenancePlanCommand,
      { version, ...input },
      { actor, db, clock: fixedClock("2026-10-16T10:00:00Z"), newId: randomUUID },
    );
  }

  /** What a change of the task gives when it keeps everything as it is, except `overrides`. */
  const keeping = (
    task: NonNullable<Awaited<ReturnType<typeof listed>>>,
    overrides: Partial<MaintenanceTaskDetails>,
  ) => ({
    change: "change" as const,
    maintenanceTaskId: task.id,
    task: {
      instruction: task.instruction,
      intervalMonths: task.intervalMonths,
      suitableForHelpers: task.suitableForHelpers,
      ...overrides,
    },
  });

  it("ST-041: The interval must stay positive", async () => {
    const name = `Clean playfield ${randomUUID()}`;
    await add(aTask({ name, intervalMonths: 3 }));
    const task = (await listed(name))!;

    expect(await change(keeping(task, { intervalMonths: 0 }))).toEqual({ ok: false, error: "interval-not-positive" });

    expect(await listed(name)).toMatchObject({ intervalMonths: 3 });
  });

  it("ST-041: Helpers cannot change the maintenance plan", async () => {
    const name = `Wax playfield ${randomUUID()}`;
    await add(aTask({ name, intervalMonths: 12 }));
    const task = (await listed(name))!;

    expect(await change(keeping(task, { intervalMonths: 6 }), anna)).toEqual({ ok: false, error: "not-authorized" });
    expect(await change({ change: "remove", maintenanceTaskId: task.id }, anna)).toEqual({
      ok: false,
      error: "not-authorized",
    });

    expect(await listed(name)).toEqual(task);
  });

  it("changes the maintenance task in place and journals the change without its text", async () => {
    const name = `Clean playfield ${randomUUID()}`;
    await add(aTask({ name }));
    const task = (await listed(name))!;

    const changed = await change(keeping(task, { instruction: "Novus 1 only.", intervalMonths: 2 }));

    expect(changed).toEqual({ ok: true, result: { maintenanceTaskId: task.id } });
    expect(await listed(name)).toMatchObject({ id: task.id, instruction: "Novus 1 only.", intervalMonths: 2 });
    const entries = (await journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID })).filter(
      (entry) => entry.data.maintenanceTaskId === task.id,
    );
    expect(entries.map((entry) => entry.data.change)).toEqual(["added", "changed"]);
    expect(JSON.stringify(entries[1].data)).not.toContain("Novus");
  });

  it("removes a maintenance task once – a removed one can neither be changed nor removed again", async () => {
    const name = `Wax playfield ${randomUUID()}`;
    await add(aTask({ name }));
    const task = (await listed(name))!;

    expect(await change({ change: "remove", maintenanceTaskId: task.id })).toEqual({
      ok: true,
      result: { maintenanceTaskId: task.id },
    });

    expect(await listed(name)).toBeUndefined();
    const entries = (await journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID })).filter(
      (entry) => entry.data.maintenanceTaskId === task.id,
    );
    expect(entries.at(-1)).toMatchObject({
      type: "EVT-MaintenancePlanChanged",
      actor: tom,
      data: { maintenanceTaskId: task.id, change: "removed" },
    });
    expect(await change({ change: "remove", maintenanceTaskId: task.id })).toEqual({
      ok: false,
      error: "maintenance-task-unknown",
    });
    expect(await change(keeping(task, {}))).toEqual({ ok: false, error: "maintenance-task-unknown" });
  });
});

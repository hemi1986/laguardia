import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { changeMaintenancePlanCommand, maintenancePlan, maintenanceTaskAppliesTo, type NewMaintenanceTask } from ".";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";

/**
 * CMD-ChangeMaintenancePlan (ST-040) through the command layer: a technician adds a maintenance task to the one
 * museum-wide maintenance plan, observed through RM-MaintenancePlan and the journal. Every test adds to the same plan
 * – it reads the version it changes, and finds its own maintenance task by a name no other test uses.
 */
const db = testDatabase();
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

const aTask = (overrides: Partial<NewMaintenanceTask>): NewMaintenanceTask => ({
  name: `Task ${randomUUID()}`,
  instruction: "Do it carefully.",
  intervalMonths: 3,
  suitableForHelpers: false,
  machineCategory: undefined,
  technology: undefined,
  startDate: "2026-10-01",
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
  it("ST-040: Technician adds a maintenance task", async () => {
    const name = `Clean glass (inside & out) ${randomUUID()}`;

    const added = await add(
      aTask({
        name,
        instruction: "Glass out, clean both sides.",
        intervalMonths: 1,
        suitableForHelpers: true,
        machineCategory: "pinball",
        startDate: "2026-10-01",
      }),
    );

    const task = await listed(name);
    expect(added).toEqual({ ok: true, result: { maintenanceTaskId: task?.id } });
    expect(task).toMatchObject({
      name,
      instruction: "Glass out, clean both sides.",
      intervalMonths: 1,
      suitableForHelpers: true,
      machineCategory: "pinball",
      technology: undefined,
      startDate: "2026-10-01",
      // The start date counts as last done: first due one interval later (HS-12).
      firstDue: "2026-11-01",
    });
    const [entry] = await journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID }).then((entries) =>
      entries.filter((candidate) => candidate.data.maintenanceTaskId === task?.id),
    );
    // Only references and non-personal facts in the journal – the name and the instruction are typed text.
    expect(entry).toMatchObject({
      type: "EVT-MaintenancePlanChanged",
      actor: tom,
      data: { maintenanceTaskId: task?.id, change: "added" },
    });
    expect(JSON.stringify(entry.data)).not.toContain("Glass out");
  });

  it("ST-040: Restriction to machine category and technology", async () => {
    const name = `Clean & adjust score reels / stepper units ${randomUUID()}`;

    expect((await add(aTask({ name, machineCategory: "pinball", technology: "em" }))).ok).toBe(true);

    const task = (await listed(name))!;
    expect(task).toMatchObject({ machineCategory: "pinball", technology: "em" });
    expect(maintenanceTaskAppliesTo(task, { machineCategory: "pinball", technology: "em" })).toBe(true);
    for (const model of [
      { machineCategory: "pinball", technology: "solid-state" },
      { machineCategory: "pinball", technology: undefined },
      { machineCategory: "arcade", technology: "crt" },
      { machineCategory: "other", technology: undefined },
    ] as const) {
      expect(maintenanceTaskAppliesTo(task, model), `${model.machineCategory} / ${model.technology}`).toBe(false);
    }
  });

  it("ST-040: Month-end start date", async () => {
    const name = `Check the flipper bushings ${randomUUID()}`;

    expect((await add(aTask({ name, intervalMonths: 1, startDate: "2026-01-31" }))).ok).toBe(true);

    expect(await listed(name)).toMatchObject({ startDate: "2026-01-31", firstDue: "2026-02-28" });
  });

  it("ST-040: Helpers cannot change the maintenance plan", async () => {
    const name = `Wax the playfield ${randomUUID()}`;
    const { version } = await maintenancePlan(db);

    expect(await add(aTask({ name }), anna)).toEqual({ ok: false, error: "not-authorized" });

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

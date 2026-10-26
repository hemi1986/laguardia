import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { changeMaintenancePlan, type ChosenMachines, type NewMaintenanceTask } from "./change-maintenance-plan";
import type { MaintenancePlan } from "./maintenance-plan";

/**
 * CMD-ChangeMaintenancePlan – the decision on adding a maintenance task (ST-040, ST-094). The required details, the
 * positive interval and the rules on the chosen machines are rules with many cases, so they are tested here (seam
 * catalog); everything else at the command.
 */
const technician = { kind: "team-member", teamMemberId: "tm-1", role: "technician" } as const;
const clock = fixedClock("2026-10-15T10:00:00Z");
const emptyPlan: MaintenancePlan = { id: "plan", maintenanceTasks: [], machinesOfTasks: [] };

const ids = (...all: string[]) => {
  const queue = [...all];
  return () => queue.shift() ?? "unexpected-id";
};

const cleanGlass: NewMaintenanceTask = {
  name: "Clean glass (inside & out)",
  instruction: "Glass out, clean both sides with glass cleaner, no ammonia on the playfield.",
  intervalMonths: 1,
  suitableForHelpers: true,
  machineIds: [],
};

const machines = (...retired: (string | [string, boolean])[]): ChosenMachines =>
  new Map(retired.map((each) => (typeof each === "string" ? [each, { retired: false }] : [each[0], { retired: each[1] }])));

const add = (task: Partial<NewMaintenanceTask>, chosen: ChosenMachines = machines(), newId = ids("task-1", "m-1", "m-2")) =>
  changeMaintenancePlan(
    emptyPlan,
    { version: 0, change: "add", task: { ...cleanGlass, ...task } },
    { actor: technician, clock, newId },
    chosen,
  );

describe("CMD-ChangeMaintenancePlan – the decision on adding a maintenance task", () => {
  it("adds the maintenance task with what the technician gave it – and no event for machines when it has none", () => {
    expect(add({})).toEqual({
      ok: true,
      state: {
        id: "plan",
        maintenanceTasks: [
          {
            id: "task-1",
            name: cleanGlass.name,
            instruction: cleanGlass.instruction,
            intervalMonths: 1,
            suitableForHelpers: true,
            removedAt: undefined,
          },
        ],
        machinesOfTasks: [],
      },
      events: [{ type: "EVT-MaintenancePlanChanged", maintenanceTaskId: "task-1", change: "added", changedBy: "tm-1" }],
    });
  });

  it("adds the chosen machines in the same step, each added at that moment – its own event names them", () => {
    const decision = add({ machineIds: ["a", "b"] }, machines("a", "b"));

    expect(decision).toMatchObject({
      ok: true,
      state: {
        machinesOfTasks: [
          { id: "m-1", maintenanceTaskId: "task-1", machineId: "a", addedAt: clock.now() },
          { id: "m-2", maintenanceTaskId: "task-1", machineId: "b", addedAt: clock.now() },
        ],
      },
      events: [
        { type: "EVT-MaintenancePlanChanged", change: "added" },
        {
          type: "EVT-MachinesOfMaintenanceTaskChanged",
          maintenanceTaskId: "task-1",
          machinesAdded: ["a", "b"],
          machinesRemoved: [],
          changedBy: "tm-1",
        },
      ],
    });
  });

  it("ST-040: Interval must be positive", () => {
    expect(add({ intervalMonths: 0 })).toEqual({ ok: false, error: "interval-not-positive" });
    expect(add({ intervalMonths: -3 })).toEqual({ ok: false, error: "interval-not-positive" });
    expect(add({ intervalMonths: undefined })).toEqual({ ok: false, error: "interval-not-positive" });
  });

  it("ST-040: Instruction is required", () => {
    expect(add({ instruction: "  " })).toEqual({ ok: false, error: "instruction-required" });
  });

  it("keeps the interval within what the due dates can be computed for", () => {
    expect(add({ intervalMonths: 1200 }).ok).toBe(true);
    expect(add({ intervalMonths: 1201 })).toEqual({ ok: false, error: "interval-too-long" });
    expect(add({ intervalMonths: 100000 })).toEqual({ ok: false, error: "interval-too-long" });
  });

  it("needs a name", () => {
    expect(add({ name: "" })).toEqual({ ok: false, error: "name-required" });
  });

  it("keeps the name and the instruction without surrounding spaces", () => {
    const decision = add({ name: "  Clean glass  ", instruction: " Glass out. " });

    expect(decision.ok && decision.state.maintenanceTasks[0]).toMatchObject({
      name: "Clean glass",
      instruction: "Glass out.",
    });
  });

  it.each([
    { title: "a machine La Guardia does not know", machineIds: ["a", "ghost"], error: "unknown-machine" },
    { title: "a machine retired meanwhile", machineIds: ["a", "gone"], error: "machine-retired" },
    { title: "the same machine twice", machineIds: ["a", "a"], error: "machine-chosen-twice" },
  ])("rejects the whole step for $title", ({ machineIds, error }) => {
    expect(add({ machineIds }, machines("a", ["gone", true]))).toEqual({ ok: false, error });
  });

  it("rejects the interval first when the machines are wrong too – nothing is decided on a half-valid step", () => {
    expect(add({ intervalMonths: 0, machineIds: ["ghost"] })).toEqual({ ok: false, error: "interval-not-positive" });
  });
});

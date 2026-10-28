import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { changeMachinesOfMaintenanceTask } from "./change-machines-of-maintenance-task";
import type { ChosenMachines } from "./chosen-machines";
import type { MachineOfTask, MaintenancePlan, MaintenanceTask } from "./maintenance-plan";

/**
 * CMD-ChangeMachinesOfMaintenanceTask – the decision on a change of the machines of maintenance tasks, from a task
 * (ST-095) and from the machine record (ST-096). What the change touches, what is nothing to do and what rejects it are
 * rules with many cases, the same from either side, so they are tested here (seam catalog); locking, the journal and the
 * version at the command.
 */
const technician = { kind: "team-member", teamMemberId: "tm-1", role: "technician" } as const;
const clock = fixedClock("2026-10-28T10:00:00Z");
const earlier = new Date("2026-09-01T10:00:00Z");

const task = (id: string, removed = false): MaintenanceTask => ({
  id,
  name: id,
  instruction: "Do it.",
  intervalMonths: 1,
  suitableForHelpers: false,
  removedAt: removed ? earlier : undefined,
});
const entry = (maintenanceTaskId: string, machineId: string, removed = false): MachineOfTask => ({
  id: `${maintenanceTaskId}/${machineId}`,
  maintenanceTaskId,
  machineId,
  addedAt: earlier,
  removedAt: removed ? earlier : undefined,
});

/**
 * Wax applies to a, b and the retired r, glass to a, oil to none; old was removed from the plan while it still applied to
 * a; c is a removed entry of wax.
 */
const plan: MaintenancePlan = {
  id: "plan",
  maintenanceTasks: [task("wax"), task("glass"), task("oil"), task("old", true), task("gone", true)],
  machinesOfTasks: [
    entry("wax", "a"),
    entry("wax", "b"),
    entry("wax", "r"),
    entry("glass", "a"),
    entry("old", "a"),
    entry("wax", "c", true),
  ],
};
const machines: ChosenMachines = new Map([
  ["a", { retired: false }],
  ["b", { retired: false }],
  ["c", { retired: false }],
  ["d", { retired: false }],
  ["r", { retired: true }],
]);

const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};
const context = () => ({ actor: technician, clock, newId: ids() });

const fromTask = (maintenanceTaskId: string, seen: string[], ticked: string[]) =>
  changeMachinesOfMaintenanceTask(plan, { maintenanceTaskId, seen, ticked }, context(), machines);
const fromMachine = (machineId: string, seen: string[], ticked: string[]) =>
  changeMachinesOfMaintenanceTask(plan, { machineId, seen, ticked }, context(), machines);

const event = (maintenanceTaskId: string, machinesAdded: string[], machinesRemoved: string[]) => ({
  type: "EVT-MachinesOfMaintenanceTaskChanged",
  maintenanceTaskId,
  machinesAdded,
  machinesRemoved,
  changedBy: "tm-1",
});

describe("CMD-ChangeMachinesOfMaintenanceTask – from a task", () => {
  it("adds the newly ticked and removes the unticked machines in one event", () => {
    const decision = fromTask("wax", ["a", "b"], ["a", "d"]);

    expect(decision).toMatchObject({ ok: true, events: [event("wax", ["d"], ["b"])] });
    expect(decision.ok && decision.state.machinesOfTasks).toEqual(
      expect.arrayContaining([
        { ...entry("wax", "b"), removedAt: clock.now() },
        { id: "new-1", maintenanceTaskId: "wax", machineId: "d", addedAt: clock.now(), removedAt: undefined },
      ]),
    );
  });

  it("starts a removed entry anew when its machine is added again", () => {
    const decision = fromTask("wax", ["a", "b"], ["a", "b", "c"]);

    expect(decision.ok && decision.state.machinesOfTasks).toContainEqual({
      ...entry("wax", "c"),
      addedAt: clock.now(),
      removedAt: undefined,
    });
  });

  it.each([
    { title: "adding a machine someone else already added", seen: [], ticked: ["a"] },
    { title: "removing a machine someone else already removed", seen: ["d"], ticked: [] },
    { title: "nothing changed", seen: ["a", "b"], ticked: ["a", "b"] },
    { title: "unticking a machine retired meanwhile – not offered is not unticked", seen: ["a", "r"], ticked: ["a"] },
    { title: "unticking a machine La Guardia does not know", seen: ["ghost"], ticked: [] },
    { title: "ticking a retired machine that still applies – it needs no check", seen: [], ticked: ["r"] },
  ])("is nothing to do: $title", ({ seen, ticked }) => {
    const decision = fromTask("wax", seen, ticked);

    expect(decision).toEqual({ ok: true, state: plan, events: [] });
    // The loaded plan itself – the command layer journals nothing only for that one.
    expect(decision.ok && decision.state).toBe(plan);
  });

  it.each([
    { title: "a removed task", task: "old", seen: [], ticked: ["d"], error: "maintenance-task-unknown" },
    { title: "an unknown task", task: "ghost", seen: [], ticked: [], error: "maintenance-task-unknown" },
    {
      title: "a machine ticked twice",
      task: "wax",
      seen: [],
      ticked: ["a", "a"],
      error: "machine-chosen-twice",
      subjects: ["a"],
    },
    {
      title: "an unknown machine ticked",
      task: "wax",
      seen: [],
      ticked: ["d", "ghost"],
      error: "unknown-machine",
      subjects: ["ghost"],
    },
    {
      title: "a retired machine ticked",
      task: "glass",
      seen: [],
      ticked: ["d", "r"],
      error: "machine-retired",
      subjects: ["r"],
    },
  ])("rejects the whole change for $title", ({ title: _title, task: maintenanceTaskId, seen, ticked, error, ...cause }) => {
    // The ticked entries that cause it are named; the fixed side needs no naming – the page is about it.
    expect(fromTask(maintenanceTaskId, seen, ticked)).toEqual({ ok: false, error, ...cause });
  });
});

describe("CMD-ChangeMachinesOfMaintenanceTask – from the machine record", () => {
  it("adds the newly ticked and removes the unticked tasks – one event per task", () => {
    const decision = fromMachine("b", ["wax"], ["glass"]);

    expect(decision).toMatchObject({ ok: true, events: [event("glass", ["b"], []), event("wax", [], ["b"])] });
    expect(decision.ok && decision.state.machinesOfTasks).toEqual(
      expect.arrayContaining([
        { ...entry("wax", "b"), removedAt: clock.now() },
        { id: "new-1", maintenanceTaskId: "glass", machineId: "b", addedAt: clock.now(), removedAt: undefined },
      ]),
    );
  });

  it("skips a task removed meanwhile that was only unticked, and stores the rest of the change", () => {
    const decision = fromMachine("a", ["wax", "old"], ["wax", "oil"]);

    expect(decision).toMatchObject({ ok: true, events: [event("oil", ["a"], [])] });
    expect(decision.ok && decision.state.machinesOfTasks).toContainEqual(entry("old", "a"));
  });

  it.each([
    { title: "adding a task someone else already added", seen: [], ticked: ["glass"] },
    { title: "nothing changed", seen: ["wax", "glass"], ticked: ["wax", "glass"] },
    {
      title: "unticking a task removed meanwhile – not offered is not unticked",
      seen: ["wax", "old"],
      ticked: ["wax"],
    },
    { title: "ticking a removed task that still applies", seen: [], ticked: ["old"] },
    { title: "unticking a task La Guardia does not know", seen: ["ghost"], ticked: [] },
  ])("is nothing to do: $title", ({ seen, ticked }) => {
    const decision = fromMachine("a", seen, ticked);

    expect(decision).toEqual({ ok: true, state: plan, events: [] });
    expect(decision.ok && decision.state).toBe(plan);
  });

  it.each([
    { title: "an unknown machine", machine: "ghost", seen: [], ticked: [], error: "unknown-machine" },
    { title: "a retired machine, also unchanged", machine: "r", seen: [], ticked: [], error: "machine-retired" },
    {
      title: "a task ticked twice",
      machine: "d",
      seen: [],
      ticked: ["wax", "wax"],
      error: "maintenance-task-chosen-twice",
      subjects: ["wax"],
    },
    {
      title: "an unknown task ticked",
      machine: "d",
      seen: [],
      ticked: ["wax", "ghost"],
      error: "maintenance-task-unknown",
      subjects: ["ghost"],
    },
    {
      title: "a removed task ticked",
      machine: "d",
      seen: [],
      ticked: ["wax", "gone"],
      error: "maintenance-task-removed",
      subjects: ["gone"],
    },
  ])("rejects the whole change for $title", ({ title: _title, machine, seen, ticked, error, ...cause }) => {
    expect(fromMachine(machine, seen, ticked)).toEqual({ ok: false, error, ...cause });
  });
});

import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { changeMaintenancePlan, type NewMaintenanceTask } from "./change-maintenance-plan";
import type { MaintenancePlan } from "./maintenance-plan";

/**
 * CMD-ChangeMaintenancePlan – the decision on adding a maintenance task (ST-040). The required details, the positive
 * interval and the restriction that has to fit are rules with many cases, so they are tested here (seam catalog);
 * everything else at the command.
 */
const technician = { kind: "team-member", teamMemberId: "tm-1", role: "technician" } as const;
const context = { actor: technician, clock: fixedClock("2026-10-15T10:00:00Z"), newId: () => "task-1" };
const emptyPlan: MaintenancePlan = { id: "plan", maintenanceTasks: [] };

const cleanGlass: NewMaintenanceTask = {
  name: "Clean glass (inside & out)",
  instruction: "Glass out, clean both sides with glass cleaner, no ammonia on the playfield.",
  intervalMonths: 1,
  suitableForHelpers: true,
  machineCategory: "pinball",
  technology: undefined,
  startDate: "2026-10-01",
};

const add = (task: Partial<NewMaintenanceTask>) =>
  changeMaintenancePlan(emptyPlan, { version: 0, change: "add", task: { ...cleanGlass, ...task } }, context);

describe("CMD-ChangeMaintenancePlan – the decision on adding a maintenance task", () => {
  it("adds the maintenance task with what the technician gave it – the start date counts as last done", () => {
    expect(add({})).toEqual({
      ok: true,
      state: { id: "plan", maintenanceTasks: [{ id: "task-1", ...cleanGlass, removedAt: undefined }] },
      events: [{ type: "EVT-MaintenancePlanChanged", maintenanceTaskId: "task-1", change: "added", changedBy: "tm-1" }],
    });
  });

  it.each([
    { category: "arcade", technology: "em" },
    { category: "other", technology: "lcd" },
  ] as const)("ST-040: Restriction must fit", ({ category, technology }) => {
    expect(add({ machineCategory: category, technology })).toEqual({
      ok: false,
      error: "technology-does-not-fit-machine-category",
    });
  });

  it("accepts every restriction that fits, and none at all", () => {
    for (const restriction of [
      { machineCategory: "pinball", technology: "em" },
      { machineCategory: "arcade", technology: "crt" },
      { machineCategory: "arcade", technology: undefined },
      { machineCategory: "other", technology: undefined },
      { machineCategory: undefined, technology: undefined },
    ] as const) {
      expect(add(restriction).ok, `${restriction.machineCategory} / ${restriction.technology}`).toBe(true);
    }
  });

  it("ST-040: Technology restriction needs a machine category", () => {
    expect(add({ machineCategory: undefined, technology: "lcd" })).toEqual({
      ok: false,
      error: "technology-without-machine-category",
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

  it("needs a name", () => {
    expect(add({ name: "" })).toEqual({ ok: false, error: "name-required" });
  });

  it("ST-040: Start date is required", () => {
    expect(add({ startDate: undefined })).toEqual({ ok: false, error: "start-date-required" });
  });

  it("keeps the name and the instruction without surrounding spaces", () => {
    const decision = add({ name: "  Clean glass  ", instruction: " Glass out. " });

    expect(decision.ok && decision.state.maintenanceTasks[0]).toMatchObject({
      name: "Clean glass",
      instruction: "Glass out.",
    });
  });
});

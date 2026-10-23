import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import type { MaintenanceTask } from "./maintenance-plan";
import { recordMaintenance, type MaintenanceFacts, type RecordMaintenanceInput } from "./record-maintenance";

/**
 * CMD-RecordMaintenance – the decision (ST-044). The date range, who may record which maintenance task and on which
 * machine are rules with many cases, so they are tested here (seam catalog); storing, the journal and the due
 * maintenance list at the command and the page.
 */
const anna = { kind: "team-member", teamMemberId: "anna", role: "helper" } as const;
const tom = { kind: "team-member", teamMemberId: "tom", role: "technician" } as const;
/** 10 June 2026, noon in Berlin. */
const tenthOfJune = fixedClock("2026-06-10T10:00:00Z");
const as = (actor: typeof anna | typeof tom) => ({ actor, clock: tenthOfJune, newId: () => "record-1" });

const cleanGlass: MaintenanceTask = {
  id: "clean-glass",
  name: "Clean glass (inside & out)",
  instruction: "Glass out, clean both sides.",
  intervalMonths: 1,
  suitableForHelpers: true,
  machineCategory: undefined,
  technology: undefined,
  startDate: "2026-01-01",
  removedAt: undefined,
};
const lg042 = { id: "lg-042", machineCategory: "pinball", technology: "dmd", retired: false } as const;
const facts: MaintenanceFacts = { maintenanceTask: cleanGlass, machine: lg042 };
const input: RecordMaintenanceInput = {
  maintenanceTaskId: "clean-glass",
  machineId: "lg-042",
  outcome: "done",
  date: "2026-06-10",
  note: "",
};

const record = (
  changes: Partial<RecordMaintenanceInput>,
  changedFacts: Partial<MaintenanceFacts> = {},
  actor: typeof anna | typeof tom = tom,
) => recordMaintenance({ ...facts, ...changedFacts }, { ...input, ...changes }, as(actor));

describe("CMD-RecordMaintenance – the decision", () => {
  it("records who carried out which maintenance task on which machine, when and with which outcome", () => {
    expect(record({ note: "  All good.  " }, {}, anna)).toEqual({
      ok: true,
      state: {
        id: "record-1",
        machineId: "lg-042",
        maintenanceTaskId: "clean-glass",
        outcome: "done",
        date: "2026-06-10",
        note: "All good.",
        recordedBy: "anna",
        recordedAt: new Date("2026-06-10T10:00:00Z"),
      },
      events: [
        {
          type: "EVT-MaintenanceRecorded",
          maintenanceRecordId: "record-1",
          machineId: "lg-042",
          maintenanceTaskId: "clean-glass",
          outcome: "done",
          date: "2026-06-10",
          recordedBy: "anna",
        },
      ],
    });
  });

  it("accepts every day of the last 7 days", () => {
    for (const date of ["2026-06-03", "2026-06-07", "2026-06-10"]) expect(record({ date }).ok, date).toBe(true);
  });

  it("ST-044: No back-dating beyond 7 days", () => {
    expect(record({ date: "2026-06-02" })).toEqual({ ok: false, error: "date-too-early" });
  });

  it("ST-044: No future dates", () => {
    expect(record({ date: "2026-06-11" })).toEqual({ ok: false, error: "date-in-the-future" });
  });

  it("ST-044: The date defaults to today", () => {
    const decision = record({ date: undefined });

    expect(decision.ok && decision.state.date).toBe("2026-06-10");
  });

  it("rejects a date that is no calendar date instead of taking today", () => {
    expect(record({ date: "2026-06-31" })).toEqual({ ok: false, error: "date-invalid" });
    expect(record({ date: "10.06.2026" })).toEqual({ ok: false, error: "date-invalid" });
  });

  it("needs an outcome, and knows the maintenance task and the machine", () => {
    expect(record({ outcome: undefined })).toEqual({ ok: false, error: "outcome-required" });
    expect(record({}, { maintenanceTask: undefined })).toEqual({ ok: false, error: "maintenance-task-unknown" });
    expect(record({}, { maintenanceTask: { ...cleanGlass, removedAt: new Date("2026-05-01T00:00:00Z") } })).toEqual({
      ok: false,
      error: "maintenance-task-unknown",
    });
    expect(record({}, { machine: undefined })).toEqual({ ok: false, error: "unknown-machine" });
  });

  it("ST-044: Helpers can only record maintenance tasks suitable for helpers", () => {
    const fuses = { ...cleanGlass, id: "fuses", name: "Check fuses, connectors, boards", suitableForHelpers: false };

    expect(record({ maintenanceTaskId: "fuses" }, { maintenanceTask: fuses }, anna)).toEqual({
      ok: false,
      error: "maintenance-not-suitable-for-helpers",
    });
    expect(record({ maintenanceTaskId: "fuses" }, { maintenanceTask: fuses }, tom).ok).toBe(true);
  });

  it("ST-044: Maintenance task must apply to the machine", () => {
    const joysticks = { ...cleanGlass, id: "joysticks", machineCategory: "arcade" as const };

    expect(record({ maintenanceTaskId: "joysticks" }, { maintenanceTask: joysticks })).toEqual({
      ok: false,
      error: "maintenance-task-does-not-apply",
    });
  });

  it("ST-044: No maintenance on retired machines", () => {
    expect(record({}, { machine: { ...lg042, retired: true } })).toEqual({ ok: false, error: "machine-retired" });
  });
});

import { describe, expect, it } from "vitest";
import type { MachineStatus } from "@/modules/collection";
import { fixedClock } from "@/platform/clock";
import { recordDefect, stricterMachineStatuses } from "./record-defect";
import type { ProblemReport } from "./report-problem";

/**
 * "Only a stricter machine status in the same step" (CMD-RecordDefect, story review 2026-10-03) – a rule with many
 * cases, tested at the decision (seam catalog).
 */
const report: ProblemReport = {
  id: "report-1",
  machineId: "machine-1",
  description: "Left flipper barely moves",
  reporter: { kind: "visitor" },
  reportedAt: new Date("2026-10-04T08:00:00Z"),
};
const context = {
  actor: { kind: "team-member", teamMemberId: "tm-1", role: "technician" } as const,
  clock: fixedClock("2026-10-04T09:00:00Z"),
  newId: () => "defect-1",
};

function decide(current: MachineStatus, chosen: MachineStatus | undefined) {
  return recordDefect(
    report,
    {
      problemReportId: report.id,
      version: 0,
      title: "Left flipper weak",
      priority: undefined,
      suitableForHelpers: false,
      machineStatus: chosen,
      machineVersion: 0,
    },
    context,
    { machine: { machineStatus: current, retired: false } },
  );
}

describe("CMD-RecordDefect – the machine status in the same step", () => {
  it.each([
    ["playable", undefined, true],
    ["playable", "limited", true],
    ["playable", "out-of-order", true],
    ["playable", "not-on-display", "machine-status-not-stricter"],
    ["playable", "playable", "machine-status-not-stricter"],
    ["limited", "out-of-order", true],
    ["limited", "limited", "machine-status-not-stricter"],
    ["limited", "playable", "machine-status-not-stricter"],
    ["out-of-order", undefined, true],
    ["out-of-order", "limited", "machine-status-not-stricter"],
    ["out-of-order", "out-of-order", "machine-status-not-stricter"],
    ["not-on-display", undefined, true],
    ["not-on-display", "out-of-order", "machine-status-not-stricter"],
  ] as const)("a %s machine, chosen %s → %s", (current, chosen, expected) => {
    const decision = decide(current, chosen);

    expect(decision.ok ? true : decision.error).toBe(expected);
  });

  it("offers exactly the stricter statuses, none for a machine out of order or not on display", () => {
    expect(stricterMachineStatuses("playable")).toEqual(["limited", "out-of-order"]);
    expect(stricterMachineStatuses("limited")).toEqual(["out-of-order"]);
    expect(stricterMachineStatuses("out-of-order")).toEqual([]);
    expect(stricterMachineStatuses("not-on-display")).toEqual([]);
  });
});

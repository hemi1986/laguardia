import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import type { Defect } from "./defect";
import { releaseClaim } from "./release-claim";

/** CMD-ReleaseClaim – the decision's table (ST-026): who may release whose claim. */
const tom = { kind: "team-member", teamMemberId: "tom", role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: "anna", role: "helper" } as const;

function aDefectClaimedBy(teamMemberId?: string): Defect {
  return {
    id: "d-1",
    machineId: "m-1",
    problemReportId: "r-1",
    title: "Left flipper weak",
    priority: "normal",
    suitableForHelpers: true,
    recordedBy: "eva",
    recordedAt: new Date("2026-10-01T08:00:00Z"),
    state: "open",
    ...(teamMemberId
      ? { claim: { claimedBy: teamMemberId, claimedAt: new Date("2026-10-02T08:00:00Z"), assignedBy: "eva" } }
      : {}),
    workLog: [],
    resolutions: [],
  };
}

function decide(actor: typeof tom | typeof anna, defect: Defect) {
  const decision = releaseClaim(
    defect,
    { defectId: defect.id, version: 0 },
    { actor, clock: fixedClock("2026-10-11T09:00:00Z"), newId: () => "unused" },
  );
  return decision.ok ? { claim: decision.state.claim, releasedBy: decision.events[0].releasedBy } : decision.error;
}

describe("CMD-ReleaseClaim – the decision", () => {
  it.each([
    ["a helper, their own claim", anna, "anna", { claim: undefined, releasedBy: "anna" }],
    ["a technician, their own claim", tom, "tom", { claim: undefined, releasedBy: "tom" }],
    ["a technician, a helper's claim", tom, "anna", { claim: undefined, releasedBy: "tom" }],
    ["a technician, another technician's claim", tom, "eva", { claim: undefined, releasedBy: "tom" }],
    ["a helper, a technician's claim", anna, "tom", "not-your-claim"],
    ["a helper, another helper's claim", anna, "ben", "not-your-claim"],
    ["a helper, no claim", anna, undefined, "not-claimed"],
    ["a technician, no claim", tom, undefined, "not-claimed"],
  ] as const)("%s", (_case, actor, claimedBy, expected) => {
    expect(decide(actor, aDefectClaimedBy(claimedBy))).toEqual(expected);
  });

  it("leaves everything else of the defect as it is", () => {
    const defect = aDefectClaimedBy("anna");
    const decision = releaseClaim(
      defect,
      { defectId: defect.id, version: 0 },
      { actor: anna, clock: fixedClock("2026-10-11T09:00:00Z"), newId: () => "unused" },
    );
    const { claim: _claim, ...rest } = defect;
    expect(decision.ok && decision.state).toEqual(rest);
  });
});

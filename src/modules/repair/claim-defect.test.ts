import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { claimDefect } from "./claim-defect";
import type { Defect, DefectState } from "./defect";

/** CMD-ClaimDefect – the decision's table (ST-025): who may claim which defect, in which state, claimed by whom. */
const tom = { kind: "team-member", teamMemberId: "tom", role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: "anna", role: "helper" } as const;

function aDefect(overrides: Partial<Defect> = {}): Defect {
  return {
    id: "d-1",
    machineId: "m-1",
    problemReportId: "r-1",
    title: "Left flipper weak",
    priority: "normal",
    suitableForHelpers: false,
    recordedBy: "eva",
    recordedAt: new Date("2026-10-01T08:00:00Z"),
    state: "open",
    ...overrides,
  };
}

const claimedBy = (teamMemberId: string) => ({ claimedBy: teamMemberId, claimedAt: new Date("2026-10-02T08:00:00Z") });

function decide(actor: typeof tom | typeof anna, defect: Defect) {
  const decision = claimDefect(
    defect,
    { defectId: defect.id, version: 0 },
    { actor, clock: fixedClock("2026-10-11T09:00:00Z"), newId: () => "unused" },
  );
  return decision.ok
    ? { claim: decision.state.claim, takenOverFrom: decision.events[0].takenOverFrom }
    : decision.error;
}

const now = new Date("2026-10-11T09:00:00Z");

describe("CMD-ClaimDefect – the decision", () => {
  it.each([
    [
      "a technician, unclaimed",
      tom,
      aDefect(),
      { claim: { claimedBy: "tom", claimedAt: now }, takenOverFrom: undefined },
    ],
    [
      "a technician, claimed by a helper",
      tom,
      aDefect({ suitableForHelpers: true, claim: claimedBy("anna") }),
      { claim: { claimedBy: "tom", claimedAt: now }, takenOverFrom: "anna" },
    ],
    [
      "a helper, suitable, unclaimed",
      anna,
      aDefect({ suitableForHelpers: true }),
      { claim: { claimedBy: "anna", claimedAt: now }, takenOverFrom: undefined },
    ],
    [
      "a helper, suitable, claimed by a technician",
      anna,
      aDefect({ suitableForHelpers: true, claim: claimedBy("tom") }),
      { claim: { claimedBy: "anna", claimedAt: now }, takenOverFrom: "tom" },
    ],
    ["a helper, not suitable", anna, aDefect(), "not-suitable-for-helpers"],
    [
      "a helper, not suitable, claimed by a technician",
      anna,
      aDefect({ claim: claimedBy("tom") }),
      "not-suitable-for-helpers",
    ],
    ["one's own claim again", tom, aDefect({ claim: claimedBy("tom") }), "already-claimed-by-you"],
  ] as const)("%s", (_case, actor, defect, expected) => {
    expect(decide(actor, defect)).toEqual(expected);
  });

  it.each(["resolved", "closed-on-retirement"] satisfies DefectState[])(
    "refuses a defect that is %s, whoever asks",
    (state) => {
      expect(decide(tom, aDefect({ state, suitableForHelpers: true }))).toBe("defect-not-open");
      expect(decide(anna, aDefect({ state, suitableForHelpers: true }))).toBe("defect-not-open");
      // The state is the first reason given – before the helper's and the claimant's.
      expect(decide(anna, aDefect({ state }))).toBe("defect-not-open");
      expect(decide(tom, aDefect({ state, claim: claimedBy("tom") }))).toBe("defect-not-open");
    },
  );
});

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
    workLog: [],
    resolutions: [],
    ...overrides,
  };
}

const claimedBy = (teamMemberId: string) => ({ claimedBy: teamMemberId, claimedAt: new Date("2026-10-02T08:00:00Z") });

/** Claiming a defect oneself – or, with `assignTo`, assigning it to a team member with that role (none: no active account). */
function decide(
  actor: typeof tom | typeof anna,
  defect: Defect,
  assignTo?: { teamMemberId: string; role?: "helper" | "technician" },
) {
  const decision = claimDefect(
    defect,
    { defectId: defect.id, version: 0, ...(assignTo ? { assignTo: assignTo.teamMemberId } : {}) },
    { actor, clock: fixedClock("2026-10-11T09:00:00Z"), newId: () => "unused" },
    { assignee: assignTo?.role && { role: assignTo.role } },
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

  const ben = (role?: "helper" | "technician") => ({ teamMemberId: "ben", role });
  const assigned = { claimedBy: "ben", claimedAt: now, assignedBy: "tom" };

  it.each([
    [
      "to a helper, suitable, unclaimed",
      tom,
      aDefect({ suitableForHelpers: true }),
      ben("helper"),
      { claim: assigned, takenOverFrom: undefined },
    ],
    ["to a technician, not suitable", tom, aDefect(), ben("technician"), { claim: assigned, takenOverFrom: undefined }],
    [
      "to someone else than its claimant",
      tom,
      aDefect({ claim: claimedBy("anna") }),
      ben("technician"),
      { claim: assigned, takenOverFrom: "anna" },
    ],
    [
      "one's own claim to someone else",
      tom,
      aDefect({ claim: claimedBy("tom") }),
      ben("technician"),
      { claim: assigned, takenOverFrom: "tom" },
    ],
    ["to a helper, not suitable", tom, aDefect(), ben("helper"), "not-suitable-for-helpers"],
    ["to its claimant", tom, aDefect({ claim: claimedBy("ben") }), ben("technician"), "already-claimed-by-them"],
    ["to someone without an active account", tom, aDefect(), ben(), "team-member-not-active"],
    ["to nobody", tom, aDefect(), { teamMemberId: "" }, "team-member-required"],
    ["by a helper", anna, aDefect({ suitableForHelpers: true }), ben("helper"), "not-authorized"],
    ["by a helper, to nobody", anna, aDefect({ suitableForHelpers: true }), { teamMemberId: "" }, "not-authorized"],
    ["a resolved defect", tom, aDefect({ state: "resolved" }), ben("technician"), "defect-not-open"],
    [
      "a defect closed on retirement",
      tom,
      aDefect({ state: "closed-on-retirement" }),
      ben("technician"),
      "defect-not-open",
    ],
  ] as const)("assigning (ST-026): %s", (_case, actor, defect, assignTo, expected) => {
    expect(decide(actor, defect, assignTo)).toEqual(expected);
  });

  it("takes an assignment to oneself as a claim of one's own (ST-026)", () => {
    expect(decide(tom, aDefect(), { teamMemberId: "tom", role: "technician" })).toEqual({
      claim: { claimedBy: "tom", claimedAt: now },
      takenOverFrom: undefined,
    });
    expect(decide(anna, aDefect({ suitableForHelpers: true }), { teamMemberId: "anna", role: "helper" })).toEqual({
      claim: { claimedBy: "anna", claimedAt: now },
      takenOverFrom: undefined,
    });
  });
});

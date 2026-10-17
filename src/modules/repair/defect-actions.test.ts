import { describe, expect, it } from "vitest";
import type { Claim, DefectState } from "./defect";
import { defectActionRefusals, type DefectTeamMember } from "./defect-actions";

const anna: DefectTeamMember = { teamMemberId: "anna", role: "helper" };
const ben: DefectTeamMember = { teamMemberId: "ben", role: "helper" };
const tom: DefectTeamMember = { teamMemberId: "tom", role: "technician" };
const claimBy = (member: DefectTeamMember): Claim => ({ claimedBy: member.teamMemberId, claimedAt: new Date(0) });

/** One row per defect a page can show – what each team member may do to it, as the commands decide (G11). */
function matrix(state: DefectState, suitableForHelpers: boolean, claim: Claim | undefined) {
  const defect = { state, suitableForHelpers, claim };
  return Object.fromEntries(
    [anna, ben, tom].map((member) => [member.teamMemberId, defectActionRefusals(defect, member)]),
  );
}

describe("defectActionRefusals – the refusal matrix of the defect's actions (architecture review 2026-10-17)", () => {
  it("an open defect for helpers, unclaimed", () => {
    expect(matrix("open", true, undefined)).toMatchInlineSnapshot(`
      {
        "anna": {
          "assign": "not-authorized",
          "claim": undefined,
          "log-work": undefined,
          "prioritize": "not-authorized",
          "release": "not-claimed",
          "resolve": undefined,
        },
        "ben": {
          "assign": "not-authorized",
          "claim": undefined,
          "log-work": undefined,
          "prioritize": "not-authorized",
          "release": "not-claimed",
          "resolve": undefined,
        },
        "tom": {
          "assign": undefined,
          "claim": undefined,
          "log-work": undefined,
          "prioritize": undefined,
          "release": "not-claimed",
          "resolve": undefined,
        },
      }
    `);
  });

  it("an open defect for helpers, claimed by Anna", () => {
    expect(matrix("open", true, claimBy(anna))).toMatchInlineSnapshot(`
      {
        "anna": {
          "assign": "not-authorized",
          "claim": "already-claimed-by-you",
          "log-work": undefined,
          "prioritize": "not-authorized",
          "release": undefined,
          "resolve": undefined,
        },
        "ben": {
          "assign": "not-authorized",
          "claim": undefined,
          "log-work": undefined,
          "prioritize": "not-authorized",
          "release": "not-your-claim",
          "resolve": undefined,
        },
        "tom": {
          "assign": undefined,
          "claim": undefined,
          "log-work": undefined,
          "prioritize": undefined,
          "release": undefined,
          "resolve": undefined,
        },
      }
    `);
  });

  it("an open defect not for helpers, claimed by Tom", () => {
    expect(matrix("open", false, claimBy(tom))).toMatchInlineSnapshot(`
      {
        "anna": {
          "assign": "not-authorized",
          "claim": "not-suitable-for-helpers",
          "log-work": undefined,
          "prioritize": "not-authorized",
          "release": "not-your-claim",
          "resolve": "not-suitable-for-helpers",
        },
        "ben": {
          "assign": "not-authorized",
          "claim": "not-suitable-for-helpers",
          "log-work": undefined,
          "prioritize": "not-authorized",
          "release": "not-your-claim",
          "resolve": "not-suitable-for-helpers",
        },
        "tom": {
          "assign": undefined,
          "claim": "already-claimed-by-you",
          "log-work": undefined,
          "prioritize": undefined,
          "release": undefined,
          "resolve": undefined,
        },
      }
    `);
  });

  it("a resolved defect", () => {
    expect(matrix("resolved", true, undefined)).toMatchInlineSnapshot(`
      {
        "anna": {
          "assign": "not-authorized",
          "claim": "defect-not-open",
          "log-work": "defect-not-open",
          "prioritize": "not-authorized",
          "release": "defect-not-open",
          "resolve": "defect-not-open",
        },
        "ben": {
          "assign": "not-authorized",
          "claim": "defect-not-open",
          "log-work": "defect-not-open",
          "prioritize": "not-authorized",
          "release": "defect-not-open",
          "resolve": "defect-not-open",
        },
        "tom": {
          "assign": "defect-not-open",
          "claim": "defect-not-open",
          "log-work": "defect-not-open",
          "prioritize": "defect-not-open",
          "release": "defect-not-open",
          "resolve": "defect-not-open",
        },
      }
    `);
  });
});

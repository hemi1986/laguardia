import { describe, expect, it } from "vitest";
import type { Claim, DefectState, Hold } from "./defect";
import { defectActionRefusals, type DefectTeamMember } from "./defect-actions";

const anna: DefectTeamMember = { teamMemberId: "anna", role: "helper" };
const ben: DefectTeamMember = { teamMemberId: "ben", role: "helper" };
const tom: DefectTeamMember = { teamMemberId: "tom", role: "technician" };
const claimBy = (member: DefectTeamMember): Claim => ({ claimedBy: member.teamMemberId, claimedAt: new Date(0) });

/** One row per defect a page can show – what each team member may do to it, as the commands decide (G11). */
function matrix(state: DefectState, suitableForHelpers: boolean, claim: Claim | undefined, hold?: Hold) {
  const defect = { state, suitableForHelpers, claim, hold };
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
          "put-on-hold": "not-claimant",
          "release": "not-claimed",
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "defect-not-on-hold",
        },
        "ben": {
          "assign": "not-authorized",
          "claim": undefined,
          "log-work": undefined,
          "prioritize": "not-authorized",
          "put-on-hold": "not-claimant",
          "release": "not-claimed",
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "defect-not-on-hold",
        },
        "tom": {
          "assign": undefined,
          "claim": undefined,
          "log-work": undefined,
          "prioritize": undefined,
          "put-on-hold": undefined,
          "release": "not-claimed",
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "defect-not-on-hold",
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
          "put-on-hold": undefined,
          "release": undefined,
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "defect-not-on-hold",
        },
        "ben": {
          "assign": "not-authorized",
          "claim": undefined,
          "log-work": undefined,
          "prioritize": "not-authorized",
          "put-on-hold": "not-claimant",
          "release": "not-your-claim",
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "defect-not-on-hold",
        },
        "tom": {
          "assign": undefined,
          "claim": undefined,
          "log-work": undefined,
          "prioritize": undefined,
          "put-on-hold": undefined,
          "release": undefined,
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "defect-not-on-hold",
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
          "put-on-hold": "not-claimant",
          "release": "not-your-claim",
          "reopen": "defect-not-resolved",
          "resolve": "not-suitable-for-helpers",
          "resume": "defect-not-on-hold",
        },
        "ben": {
          "assign": "not-authorized",
          "claim": "not-suitable-for-helpers",
          "log-work": undefined,
          "prioritize": "not-authorized",
          "put-on-hold": "not-claimant",
          "release": "not-your-claim",
          "reopen": "defect-not-resolved",
          "resolve": "not-suitable-for-helpers",
          "resume": "defect-not-on-hold",
        },
        "tom": {
          "assign": undefined,
          "claim": "already-claimed-by-you",
          "log-work": undefined,
          "prioritize": undefined,
          "put-on-hold": undefined,
          "release": undefined,
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "defect-not-on-hold",
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
          "put-on-hold": "defect-not-open",
          "release": "defect-not-open",
          "reopen": undefined,
          "resolve": "defect-not-open",
          "resume": "defect-not-on-hold",
        },
        "ben": {
          "assign": "not-authorized",
          "claim": "defect-not-open",
          "log-work": "defect-not-open",
          "prioritize": "not-authorized",
          "put-on-hold": "defect-not-open",
          "release": "defect-not-open",
          "reopen": undefined,
          "resolve": "defect-not-open",
          "resume": "defect-not-on-hold",
        },
        "tom": {
          "assign": "defect-not-open",
          "claim": "defect-not-open",
          "log-work": "defect-not-open",
          "prioritize": "defect-not-open",
          "put-on-hold": "defect-not-open",
          "release": "defect-not-open",
          "reopen": undefined,
          "resolve": "defect-not-open",
          "resume": "defect-not-on-hold",
        },
      }
    `);
  });

  it("an open defect for helpers on hold, claimed by Anna (ST-029)", () => {
    const hold: Hold = { reason: "waiting-for-part", note: undefined, heldAt: new Date(0) };
    expect(matrix("open", true, claimBy(anna), hold)).toMatchInlineSnapshot(`
      {
        "anna": {
          "assign": "not-authorized",
          "claim": "already-claimed-by-you",
          "log-work": undefined,
          "prioritize": "not-authorized",
          "put-on-hold": "defect-on-hold",
          "release": undefined,
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": undefined,
        },
        "ben": {
          "assign": "not-authorized",
          "claim": undefined,
          "log-work": undefined,
          "prioritize": "not-authorized",
          "put-on-hold": "defect-on-hold",
          "release": "not-your-claim",
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": "not-claimant",
        },
        "tom": {
          "assign": undefined,
          "claim": undefined,
          "log-work": undefined,
          "prioritize": undefined,
          "put-on-hold": "defect-on-hold",
          "release": undefined,
          "reopen": "defect-not-resolved",
          "resolve": undefined,
          "resume": undefined,
        },
      }
    `);
  });
});

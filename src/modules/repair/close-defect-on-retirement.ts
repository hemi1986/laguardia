import type { Decision, DecisionContext } from "@/platform/command";
import type { Defect } from "./defect";

/**
 * CMD-CloseDefectOnRetirement (AGG-Defect, ST-039): run by POL-RetirementClosesDefects for every defect of a retired
 * machine that is not resolved. *Closed on retirement* is final and does not count as resolved (AGG-Defect).
 */

/** Only the system – the retirement policy – closes a defect on retirement. */
export const closingOnRetirementActors = ["system"] as const;

export type CloseDefectOnRetirementInput = { defectId: string };

export type DefectClosedOnRetirement = { type: "EVT-DefectClosedOnRetirement"; defectId: string; machineId: string };

export type CloseDefectOnRetirementError = "defect-not-open";

export function closeDefectOnRetirement(
  defect: Defect,
  _input: CloseDefectOnRetirementInput,
  { clock }: DecisionContext,
): Decision<Defect, DefectClosedOnRetirement, CloseDefectOnRetirementError> {
  // A resolved defect stays resolved; one closed on retirement is final (AGG-Defect invariants).
  if (defect.state !== "open") return { ok: false, error: "defect-not-open" };
  // Like resolving, closing ends the claim and any hold – only an open defect is on hold (AGG-Defect invariant).
  return {
    ok: true,
    state: {
      ...defect,
      claim: undefined,
      hold: undefined,
      state: "closed-on-retirement",
      closedOnRetirementAt: clock.now(),
    },
    events: [{ type: "EVT-DefectClosedOnRetirement", defectId: defect.id, machineId: defect.machineId }],
  };
}

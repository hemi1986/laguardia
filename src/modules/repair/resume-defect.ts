import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { Defect } from "./defect";
import { mayChangeHold } from "./put-defect-on-hold";

/**
 * CMD-ResumeDefect (AGG-Defect, ST-029): a defect on hold can progress again – it is open and not on hold. One tap,
 * no input (user, 2026-10-17, G22).
 */

/** Who may resume a defect – technicians any, a helper the defect they claimed. */
export const resumingActors = ["helper", "technician"] as const;

type ResumingPerson = ActorOf<(typeof resumingActors)[number]>;

export type ResumeDefectInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16). */
  version: number;
};

export type DefectResumed = { type: "EVT-DefectResumed"; defectId: string; machineId: string };

export type ResumeDefectError = "defect-not-on-hold" | "not-claimant";

/** Why this team member may not resume the defect as it is – undefined when they may (G11). */
export function resumeRefusal(
  defect: Pick<Defect, "hold" | "claim">,
  actor: Pick<ResumingPerson, "teamMemberId" | "role">,
): ResumeDefectError | undefined {
  // Only an open defect can be on hold, so a defect on hold is open.
  if (!defect.hold) return "defect-not-on-hold";
  if (!mayChangeHold(defect, actor)) return "not-claimant";
  return undefined;
}

export function resumeDefect(
  defect: Defect,
  _input: ResumeDefectInput,
  { actor }: DecisionContext<ResumingPerson>,
): Decision<Defect, DefectResumed, ResumeDefectError> {
  const refusal = resumeRefusal(defect, actor);
  if (refusal) return { ok: false, error: refusal };
  return {
    ok: true,
    state: { ...defect, hold: undefined },
    events: [{ type: "EVT-DefectResumed", defectId: defect.id, machineId: defect.machineId }],
  };
}

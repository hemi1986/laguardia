import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";

/**
 * CMD-ResolveDefect (AGG-Defect, ST-028): a team member resolves an open defect with a closing note, which says how it
 * ended. Nobody needs to have claimed it (HS-8). The machine status stays as it is – a technician decides on it
 * (HS-6, POL-ResolvedDefectsReturnMachineToPlay).
 */

/** Who may resolve a defect – every team member (helpers only defects suitable for helpers, HS-8). */
export const resolvingActors = ["helper", "technician"] as const;

type ResolvingPerson = ActorOf<(typeof resolvingActors)[number]>;

export type ResolveDefectInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16). */
  version: number;
  closingNote: string;
};

export type DefectResolved = {
  type: "EVT-DefectResolved";
  defectId: string;
  machineId: string;
  resolvedBy: TeamMemberId;
};

export type ResolveDefectError = "defect-not-open" | "not-suitable-for-helpers" | "closing-note-required";

/**
 * Why this team member may not resolve the defect as it is, whatever they write – undefined when they may. The
 * decision applies it, and a page asks it to offer the control only to someone it will not reject (G11).
 */
export function resolveRefusal(
  defect: Pick<Defect, "state" | "suitableForHelpers">,
  actor: Pick<ResolvingPerson, "role">,
): Exclude<ResolveDefectError, "closing-note-required"> | undefined {
  // A resolved defect can only be reopened; one closed on retirement is final (AGG-Defect invariants).
  if (defect.state !== "open") return "defect-not-open";
  if (actor.role === "helper" && !defect.suitableForHelpers) return "not-suitable-for-helpers";
  return undefined;
}

export function resolveDefect(
  defect: Defect,
  input: ResolveDefectInput,
  { actor, clock, newId }: DecisionContext<ResolvingPerson>,
): Decision<Defect, DefectResolved, ResolveDefectError> {
  const refusal = resolveRefusal(defect, actor);
  if (refusal) return { ok: false, error: refusal };
  const closingNote = input.closingNote.trim();
  if (!closingNote) return { ok: false, error: "closing-note-required" };
  // Resolving ends the claim and any hold (AGG-Defect invariant, ST-029).
  return {
    ok: true,
    state: {
      ...defect,
      claim: undefined,
      hold: undefined,
      state: "resolved",
      resolutions: [
        ...defect.resolutions,
        { id: newId(), closingNote, resolvedBy: actor.teamMemberId, resolvedAt: clock.now() },
      ],
    },
    events: [
      { type: "EVT-DefectResolved", defectId: defect.id, machineId: defect.machineId, resolvedBy: actor.teamMemberId },
    ],
  };
}

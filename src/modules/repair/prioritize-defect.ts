import type { ActorOf, Decision, DecisionContext, Role, TeamMemberId } from "@/platform/command";
import type { Defect, Priority } from "./defect";

/**
 * CMD-PrioritizeDefect (AGG-Defect, ST-027): a technician changes the priority of an open defect, so that the team
 * works on the most urgent defects first. Only an open defect: a resolved one can only be reopened, one closed on
 * retirement is final (AGG-Defect invariants).
 */

/** Who may prioritize a defect – technicians only (CONTEXT.md: Technician). */
export const prioritizingActors = ["technician"] as const;

type PrioritizingPerson = ActorOf<(typeof prioritizingActors)[number]>;

export type PrioritizeDefectInput = {
  defectId: string;
  /** The version of the defect the technician saw (HS-16). */
  version: number;
  /** None when nothing was chosen – the decision rejects it, it never becomes a default. */
  priority: Priority | undefined;
};

export type DefectPrioritized = {
  type: "EVT-DefectPrioritized";
  defectId: string;
  machineId: string;
  priority: Priority;
  prioritizedBy: TeamMemberId;
};

export type PrioritizeDefectError = "defect-not-open" | "priority-required" | "priority-unchanged";

/**
 * Why this team member may not change the defect's priority as it is, whatever they choose – undefined when they may.
 * The decision applies it, and a page asks it to offer the control only to someone it will not reject (G11). Only
 * technicians: the command layer refuses anyone else before the decision runs, this says so to a page.
 */
export function prioritizeRefusal(
  defect: Pick<Defect, "state">,
  teamMember: { role: Role },
): "not-authorized" | "defect-not-open" | undefined {
  if (teamMember.role !== "technician") return "not-authorized";
  if (defect.state !== "open") return "defect-not-open";
  return undefined;
}

/**
 * Why the defect cannot be changed to this priority – undefined when it can. Choosing the priority it has would record
 * no fact (every successful command records one); a page asks it for every priority it offers as a choice (G11).
 */
export function priorityRefusal(defect: Pick<Defect, "priority">, priority: Priority): "priority-unchanged" | undefined {
  return priority === defect.priority ? "priority-unchanged" : undefined;
}

export function prioritizeDefect(
  defect: Defect,
  input: PrioritizeDefectInput,
  { actor }: DecisionContext<PrioritizingPerson>,
): Decision<Defect, DefectPrioritized, PrioritizeDefectError | "not-authorized"> {
  const refusal = prioritizeRefusal(defect, actor);
  if (refusal) return { ok: false, error: refusal };
  if (!input.priority) return { ok: false, error: "priority-required" };
  const unchanged = priorityRefusal(defect, input.priority);
  if (unchanged) return { ok: false, error: unchanged };
  return {
    ok: true,
    state: { ...defect, priority: input.priority },
    events: [
      {
        type: "EVT-DefectPrioritized",
        defectId: defect.id,
        machineId: defect.machineId,
        priority: input.priority,
        prioritizedBy: actor.teamMemberId,
      },
    ],
  };
}

import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";

/**
 * CMD-LogWork (AGG-Defect, ST-024): a team member logs what they did on an open defect and which parts they used. Anyone
 * on the team may, with or without a claim, also on a defect not suitable for helpers (HS-8). The entry is only added:
 * the work log is never changed. The first entry counts as the start of repair (HS-9).
 */

/** Who may log work – every team member (HS-8). */
export const loggingActors = ["helper", "technician"] as const;

type LoggingPerson = ActorOf<(typeof loggingActors)[number]>;

export type LogWorkInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16). */
  version: number;
  whatWasDone: string;
  /** Free text; empty when no parts were used. */
  partsUsed: string;
};

export type WorkLogged = {
  type: "EVT-WorkLogged";
  defectId: string;
  machineId: string;
  workLogEntryId: string;
  loggedBy: TeamMemberId;
};

export type LogWorkError = "defect-not-open" | "what-was-done-required";

/**
 * Why nobody may log work on the defect as it is, whatever they write – undefined when they may. The decision applies
 * it, and a page asks it to offer the control only where it will not be rejected (G11).
 */
export function logWorkRefusal(
  defect: Pick<Defect, "state">,
): Exclude<LogWorkError, "what-was-done-required"> | undefined {
  // A resolved defect can only be reopened; one closed on retirement is final (AGG-Defect invariants).
  return defect.state === "open" ? undefined : "defect-not-open";
}

export function logWork(
  defect: Defect,
  input: LogWorkInput,
  { actor, clock, newId }: DecisionContext<LoggingPerson>,
): Decision<Defect, WorkLogged, LogWorkError> {
  const refusal = logWorkRefusal(defect);
  if (refusal) return { ok: false, error: refusal };
  const whatWasDone = input.whatWasDone.trim();
  if (!whatWasDone) return { ok: false, error: "what-was-done-required" };
  const entry = {
    id: newId(),
    whatWasDone,
    partsUsed: input.partsUsed.trim() || undefined,
    loggedBy: actor.teamMemberId,
    loggedAt: clock.now(),
  };
  return {
    ok: true,
    state: { ...defect, workLog: [...defect.workLog, entry] },
    events: [
      {
        type: "EVT-WorkLogged",
        defectId: defect.id,
        machineId: defect.machineId,
        workLogEntryId: entry.id,
        loggedBy: entry.loggedBy,
      },
    ],
  };
}

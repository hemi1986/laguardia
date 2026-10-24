import type { MachineStatus } from "@/modules/collection";
import type { ActorOf, Decision, DecisionContext, Role, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";
import { stricterMachineStatuses } from "./record-defect";

/**
 * CMD-ReopenDefect (AGG-Defect, ST-030): the fault of a resolved defect came back – the defect is open again, not on
 * hold and unclaimed, with its earlier resolutions kept and the reopening as an entry of its own. Any team member may
 * reopen (HS-7); a technician may set the machine to a stricter status in the same step
 * (POL-DefectMayChangeMachineStatus, as in ST-018).
 */

/** Who may reopen a defect – every team member (HS-7). */
export const reopeningActors = ["helper", "technician"] as const;

type ReopeningPerson = ActorOf<(typeof reopeningActors)[number]>;

export type ReopenDefectInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16). */
  version: number;
  reason: string;
  /** A stricter machine status chosen in the same step – technicians only; none leaves the status as it is. */
  machineStatus?: MachineStatus;
  /** The version of the machine the technician saw – needed with a chosen status (HS-16). */
  machineVersion?: number;
};

/** What the decision reads besides the defect: its machine as Collection knows it now. */
export type ReopeningFacts = { machine: { machineStatus: MachineStatus; retired: boolean } | undefined };

export type DefectReopened = {
  type: "EVT-DefectReopened";
  defectId: string;
  machineId: string;
  title: string;
  /** Typed text: in the aggregate, never in the journal (ST-003). */
  reason: string;
  reopenedBy: TeamMemberId;
};

export type ReopenDefectError =
  | "defect-not-resolved"
  | "machine-retired"
  | "reopen-reason-required"
  | "machine-status-not-stricter"
  | "not-authorized";

/** Why this defect cannot be reopened as it is, whatever reason is given – undefined when it can (G11). */
export function reopenRefusal(
  defect: Pick<Defect, "state">,
  facts: ReopeningFacts | undefined,
): Exclude<ReopenDefectError, "reopen-reason-required" | "machine-status-not-stricter" | "not-authorized"> | undefined {
  // Only a resolved defect can be reopened; one closed on retirement is final (AGG-Defect invariants).
  if (defect.state !== "resolved") return "defect-not-resolved";
  if (facts?.machine?.retired) return "machine-retired";
  return undefined;
}

/** Whether this team member may set the machine to a stricter status while reopening – technicians only (ST-030). */
export function mayChangeMachineStatusWhileReopening(teamMember: { role: Role }): boolean {
  return teamMember.role === "technician";
}

export function reopenDefect(
  defect: Defect,
  input: ReopenDefectInput,
  { actor, clock, newId }: DecisionContext<ReopeningPerson>,
  facts: ReopeningFacts,
): Decision<Defect, DefectReopened, ReopenDefectError> {
  const refusal = reopenRefusal(defect, facts);
  if (refusal) return { ok: false, error: refusal };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "reopen-reason-required" };
  if (input.machineStatus) {
    // Helpers cannot change the machine status while reopening (POL-DefectMayChangeMachineStatus).
    if (!mayChangeMachineStatusWhileReopening(actor)) return { ok: false, error: "not-authorized" };
    if (!facts.machine || !stricterMachineStatuses(facts.machine.machineStatus).includes(input.machineStatus))
      return { ok: false, error: "machine-status-not-stricter" };
  }
  // A reopened defect is open, not on hold and unclaimed (AGG-Defect invariant).
  return {
    ok: true,
    state: {
      ...defect,
      state: "open",
      claim: undefined,
      hold: undefined,
      reopenings: [
        ...defect.reopenings,
        { id: newId(), reason, reopenedBy: actor.teamMemberId, reopenedAt: clock.now() },
      ],
    },
    events: [
      {
        type: "EVT-DefectReopened",
        defectId: defect.id,
        machineId: defect.machineId,
        title: defect.title,
        reason,
        reopenedBy: actor.teamMemberId,
      },
    ],
  };
}

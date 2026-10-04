import type { MachineStatus } from "@/modules/collection";
import { created, type ActorOf, type Decision, type DecisionContext } from "@/platform/command";
import type { Defect, Priority } from "./defect";
import { defects } from "./defects";
import type { ProblemReport, ReportingFacts } from "./report-problem";

/**
 * CMD-RecordDefect (AGG-ProblemReport, ST-018): a technician turns an untriaged problem report into a defect – and may
 * make the machine status stricter in the same step (HS-3, POL-DefectMayChangeMachineStatus). Handled by the problem
 * report (HS-16): it checks it is still untriaged, marks itself triaged and creates the defect, all in one decision.
 */

/** Who may record a defect – the allowed actors of CMD-RecordDefect. */
export const recordingActors = ["technician"] as const;

type RecordingPerson = ActorOf<(typeof recordingActors)[number]>;

/**
 * The machine statuses the same step may set (story review 2026-10-03, events.yaml): only a stricter one –
 * Playable → Limited or Out of order; Limited → Out of order; Out of order or Not on display keeps its status.
 */
export function stricterMachineStatuses(current: MachineStatus): MachineStatus[] {
  if (current === "playable") return ["limited", "out-of-order"];
  if (current === "limited") return ["out-of-order"];
  return [];
}

/**
 * What the technician gave (ST-073, Q19): a missing priority is "no priority chosen" (normal); a missing machine status
 * is "do not change the status". The machine version is the one the technician saw on the form.
 */
export type RecordDefectInput = {
  problemReportId: string;
  /** The version of the problem report the technician saw (HS-16). */
  version: number;
  title: string;
  priority: Priority | undefined;
  suitableForHelpers: boolean;
  machineStatus: MachineStatus | undefined;
  machineVersion: number | undefined;
};

export type DefectRecorded = {
  type: "EVT-DefectRecorded";
  defectId: string;
  problemReportId: string;
  machineId: string;
  title: string;
  priority: Priority;
  suitableForHelpers: boolean;
};

export type RecordDefectError = "already-triaged" | "title-required" | "machine-status-not-stricter";

export function recordDefect(
  report: ProblemReport,
  input: RecordDefectInput,
  { actor, clock, newId }: DecisionContext<RecordingPerson>,
  { machine }: ReportingFacts,
): Decision<ProblemReport, DefectRecorded, RecordDefectError> {
  if (report.triage) return { ok: false, error: "already-triaged" };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title-required" };
  if (input.machineStatus && !(machine && stricterMachineStatuses(machine.machineStatus).includes(input.machineStatus))) {
    return { ok: false, error: "machine-status-not-stricter" };
  }
  const now = clock.now();
  const defect: Defect = {
    id: newId(),
    machineId: report.machineId,
    problemReportId: report.id,
    title,
    priority: input.priority ?? "normal",
    suitableForHelpers: input.suitableForHelpers,
    recordedBy: actor.teamMemberId,
    recordedAt: now,
    state: "open",
  };
  return {
    ok: true,
    state: {
      ...report,
      triage: { outcome: "defect-recorded", triagedBy: actor.teamMemberId, triagedAt: now, defectId: defect.id },
    },
    events: [
      {
        type: "EVT-DefectRecorded",
        defectId: defect.id,
        problemReportId: report.id,
        machineId: report.machineId,
        title,
        priority: defect.priority,
        suitableForHelpers: defect.suitableForHelpers,
      },
    ],
    created: [created(defects, defect)],
  };
}

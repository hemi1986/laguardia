import type { MachineCategory, Technology } from "@/modules/collection";
import type { ActorOf, Decision, DecisionContext, Role, TeamMemberId } from "@/platform/command";
import { addDays, isCalendarDate, today, type CalendarDate } from "@/platform/time";
import type { MaintenanceOutcome } from "./maintenance-outcome";
import type { MaintenanceTask } from "./maintenance-plan";
import { maintenanceTaskAppliesTo } from "./maintenance-plans";

/**
 * CMD-RecordMaintenance (AGG-MaintenanceRecord, ST-044): a team member records that they carried out a maintenance task
 * on a machine – done or partially done, with an optional note. Only *done* restarts the interval (the due maintenance
 * list reads it). A maintenance record is never changed or removed.
 */

/** Who may record maintenance – every team member; helpers only maintenance tasks suitable for helpers. */
export const recordingActors = ["helper", "technician"] as const;

type RecordingPerson = ActorOf<(typeof recordingActors)[number]>;

export { maintenanceOutcomes, type MaintenanceOutcome } from "./maintenance-outcome";

/** How far back a maintenance record may be dated (decision D6). */
export const LONGEST_BACK_DATING_DAYS = 7;

export type RecordMaintenanceInput = {
  maintenanceTaskId: string;
  machineId: string;
  /** None when nothing was chosen – the decision rejects it. */
  outcome: MaintenanceOutcome | undefined;
  /** The day it was carried out; none given: today. */
  date: CalendarDate | undefined;
  /** Free text; empty when none. */
  note: string;
};

/** The machine as maintenance needs it to decide – Collection's published facts (context map). */
export type MachineForRecording = {
  id: string;
  machineCategory: MachineCategory;
  technology: Technology | undefined;
  retired: boolean;
};

/** What the decision reads besides the input: the maintenance task from the plan and the machine from Collection. */
export type MaintenanceFacts = {
  maintenanceTask: MaintenanceTask | undefined;
  machine: MachineForRecording | undefined;
};

/** AGG-MaintenanceRecord – append-only, one per machine and maintenance task carried out (data model). */
export type MaintenanceRecord = {
  id: string;
  machineId: string;
  maintenanceTaskId: string;
  outcome: MaintenanceOutcome;
  /** The Berlin calendar day it was carried out – up to 7 days back. */
  date: CalendarDate;
  /** None when no note was written. */
  note: string | undefined;
  recordedBy: TeamMemberId;
  /** When it was recorded. */
  recordedAt: Date;
};

export type MaintenanceRecorded = {
  type: "EVT-MaintenanceRecorded";
  maintenanceRecordId: string;
  machineId: string;
  maintenanceTaskId: string;
  outcome: MaintenanceOutcome;
  date: CalendarDate;
  recordedBy: TeamMemberId;
};

export type RecordMaintenanceError =
  | "maintenance-task-unknown"
  | "machine-unknown"
  | "machine-retired"
  | "maintenance-task-does-not-apply"
  | "maintenance-not-suitable-for-helpers"
  | "outcome-required"
  | "date-invalid"
  | "date-too-early"
  | "date-in-the-future";

/**
 * Why this team member may not record the maintenance task on the machine, whatever they enter – undefined when they
 * may. The one rule of CMD-RecordMaintenance about who records what where: the decision applies it, and a page asks it
 * to offer „Wartung erfassen“ only where the command will not reject it (G11).
 */
export function recordRefusal(
  maintenanceTask:
    (Pick<MaintenanceTask, "suitableForHelpers" | "machineCategory" | "technology"> & { removedAt?: Date }) | undefined,
  machine: Omit<MachineForRecording, "id"> | undefined,
  teamMember: { role: Role },
):
  | "maintenance-task-unknown"
  | "machine-unknown"
  | "machine-retired"
  | "maintenance-task-does-not-apply"
  | "maintenance-not-suitable-for-helpers"
  | undefined {
  // A removed maintenance task is never due, and nothing is recorded for it any more.
  if (!maintenanceTask || maintenanceTask.removedAt) return "maintenance-task-unknown";
  if (!machine) return "machine-unknown";
  if (machine.retired) return "machine-retired";
  if (!maintenanceTaskAppliesTo(maintenanceTask, machine)) return "maintenance-task-does-not-apply";
  if (teamMember.role === "helper" && !maintenanceTask.suitableForHelpers)
    return "maintenance-not-suitable-for-helpers";
  return undefined;
}

export function recordMaintenance(
  { maintenanceTask, machine }: MaintenanceFacts,
  input: RecordMaintenanceInput,
  { actor, clock, newId }: DecisionContext<RecordingPerson>,
): Decision<MaintenanceRecord, MaintenanceRecorded, RecordMaintenanceError> {
  const refusal = recordRefusal(maintenanceTask, machine, actor);
  if (refusal || !maintenanceTask || !machine) return { ok: false, error: refusal ?? "maintenance-task-unknown" };
  if (!input.outcome) return { ok: false, error: "outcome-required" };
  const now = today(clock);
  // No date given is today; a date given must be a real calendar date – never silently today.
  if (input.date !== undefined && !isCalendarDate(input.date)) return { ok: false, error: "date-invalid" };
  const date = input.date ?? now;
  if (date > now) return { ok: false, error: "date-in-the-future" };
  if (date < addDays(now, -LONGEST_BACK_DATING_DAYS)) return { ok: false, error: "date-too-early" };
  const record: MaintenanceRecord = {
    id: newId(),
    machineId: machine.id,
    maintenanceTaskId: maintenanceTask.id,
    outcome: input.outcome,
    date,
    note: input.note.trim() || undefined,
    recordedBy: actor.teamMemberId,
    recordedAt: clock.now(),
  };
  return {
    ok: true,
    state: record,
    events: [
      {
        type: "EVT-MaintenanceRecorded",
        maintenanceRecordId: record.id,
        machineId: record.machineId,
        maintenanceTaskId: record.maintenanceTaskId,
        outcome: record.outcome,
        date: record.date,
        recordedBy: record.recordedBy,
      },
    ],
  };
}

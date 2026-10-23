import type { TeamMemberId } from "@/platform/command";

/** The priorities of a defect (CONTEXT.md: Priority), in the order a choice offers them; *normal* is the default. */
export const priorities = ["high", "normal", "low"] as const;
export type Priority = (typeof priorities)[number];

/** The states of a defect (data model); a recorded defect is *open*. */
export const defectStates = ["open", "resolved", "closed-on-retirement"] as const;
export type DefectState = (typeof defectStates)[number];

/**
 * The Claim value object of AGG-Defect (data model, ST-025): who took the defect on, and since when – and, when a
 * technician assigned it to them, who did (ST-026).
 */
export type Claim = { claimedBy: TeamMemberId; claimedAt: Date; assignedBy?: TeamMemberId };

/**
 * Why a defect waits (CONTEXT.md: On hold, ST-029), in the order a choice offers them – the glossary's order, none
 * preselected (G20).
 */
export const holdReasons = ["waiting-for-part", "waiting-for-technician", "other"] as const;
export type HoldReason = (typeof holdReasons)[number];

/**
 * The Hold value object of AGG-Defect (data model, ST-029): why an open defect cannot progress for now, an optional
 * note, and since when. A defect on hold is still open.
 */
export type Hold = { reason: HoldReason; note: string | undefined; heldAt: Date };

/**
 * The Resolution entity of AGG-Defect (data model, ST-028): how a defect ended – one per resolve, kept for the repair
 * history. An entry is stored once and never updated (Q13) – a reopening is an entry of its own (data model, ST-030),
 * never a change of the resolution it follows.
 */
export type Resolution = { id: string; closingNote: string; resolvedBy: TeamMemberId; resolvedAt: Date };

/**
 * The Reopening entity of AGG-Defect (data model, ST-030): why a resolved defect is open again, who reopened it and
 * when – one per reopen, stored after the resolution it follows and never changed (Q13). The reason is typed text.
 */
export type Reopening = { id: string; reason: string; reopenedBy: TeamMemberId; reopenedAt: Date };

/** A resolution or a reopening of a defect, tagged – one step of how it ended and came back (ST-030). */
export type ResolutionOrReopening = ({ kind: "resolution" } & Resolution) | ({ kind: "reopening" } & Reopening);

/**
 * A defect's resolutions and reopenings in the order they happened, the oldest first – they alternate, each reopening
 * after the resolution it followed (data model, ST-030).
 */
export function resolutionsAndReopenings(defect: Pick<Defect, "resolutions" | "reopenings">): ResolutionOrReopening[] {
  const at = (step: ResolutionOrReopening) => (step.kind === "resolution" ? step.resolvedAt : step.reopenedAt);
  return [
    ...defect.resolutions.map((resolution) => ({ kind: "resolution" as const, ...resolution })),
    ...defect.reopenings.map((reopening) => ({ kind: "reopening" as const, ...reopening })),
  ].sort((a, b) => at(a).getTime() - at(b).getTime());
}

/**
 * A work log entry of AGG-Defect (data model, ST-024): what a team member did on the defect, and with which parts. Its
 * photos follow with ST-032.
 */
export type WorkLogEntry = {
  id: string;
  whatWasDone: string;
  /** Free text; none when no parts were used. */
  partsUsed: string | undefined;
  loggedBy: TeamMemberId;
  loggedAt: Date;
};

/** AGG-Defect – current state (docs/architecture/data-model.md). */
export type Defect = {
  id: string;
  machineId: string;
  problemReportId: string;
  title: string;
  priority: Priority;
  suitableForHelpers: boolean;
  recordedBy: TeamMemberId;
  recordedAt: Date;
  state: DefectState;
  /** None while nobody has claimed it – a defect has at most one claimant. */
  claim?: Claim;
  /** None unless it is on hold – only an open defect can be (ST-029). */
  hold?: Hold;
  /** When its machine's retirement closed it – only for the state *closed on retirement* (ST-039). */
  closedOnRetirementAt?: Date;
  /** The oldest first – only added to, never changed or removed (Q13). */
  workLog: WorkLogEntry[];
  /** One per resolve, the oldest first – only added to, never changed (Q13). */
  resolutions: Resolution[];
  /** One per reopen, the oldest first – only added to, never changed (Q13, ST-030). */
  reopenings: Reopening[];
};

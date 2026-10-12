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
 * The Resolution entity of AGG-Defect (data model, ST-028): how a defect ended – one per resolve, kept for the repair
 * history. An entry is stored once and never updated (Q13) – a reopening is an entry of its own (data model, ST-030),
 * never a change of the resolution it follows.
 */
export type Resolution = { id: string; closingNote: string; resolvedBy: TeamMemberId; resolvedAt: Date };

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

/** AGG-Defect – current state (docs/architecture/data-model.md); its hold follows with its story. */
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
  /** The oldest first – only added to, never changed or removed (Q13). */
  workLog: WorkLogEntry[];
  /** One per resolve, the oldest first – only added to, never changed (Q13). */
  resolutions: Resolution[];
};

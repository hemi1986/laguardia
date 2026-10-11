import type { TeamMemberId } from "@/platform/command";

/** The priorities of a defect (CONTEXT.md: Priority), in the order a choice offers them; *normal* is the default. */
export const priorities = ["high", "normal", "low"] as const;
export type Priority = (typeof priorities)[number];

/** The states of a defect (data model); a recorded defect is *open*. */
export const defectStates = ["open", "resolved", "closed-on-retirement"] as const;
export type DefectState = (typeof defectStates)[number];

/** The Claim value object of AGG-Defect (data model, ST-025): who took the defect on, and since when. */
export type Claim = { claimedBy: TeamMemberId; claimedAt: Date };

/**
 * The Resolution entity of AGG-Defect (data model, ST-028): how a defect ended – one per resolve, kept for the repair
 * history. Its reopening follows with ST-030.
 */
export type Resolution = { id: string; closingNote: string; resolvedBy: TeamMemberId; resolvedAt: Date };

/** AGG-Defect – current state (docs/architecture/data-model.md); its hold and work log follow with their stories. */
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
  /** One per resolve, the oldest first – only added to, never changed (Q13). */
  resolutions: Resolution[];
};

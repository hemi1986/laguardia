import type { TeamMemberId } from "@/platform/command";

/** The priorities of a defect (CONTEXT.md: Priority), in the order a choice offers them; *normal* is the default. */
export const priorities = ["high", "normal", "low"] as const;
export type Priority = (typeof priorities)[number];

/** The states of a defect (data model); a recorded defect is *open*. */
export const defectStates = ["open", "resolved", "closed-on-retirement"] as const;
export type DefectState = (typeof defectStates)[number];

/** AGG-Defect – current state (docs/architecture/data-model.md); its claim, hold and work log follow with their stories. */
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
};

import { commandErrorText, teamMessages } from "@/platform/messages";
import type { RecordDefectState } from "./actions";

const { recordDefect: texts } = teamMessages;

/** The rejection in words – naming who triaged first, or the machine retired meanwhile (story review 2026-10-03). */
export function rejectionText(state: NonNullable<RecordDefectState>, museumNumber: string): string {
  if (state.error === "already-triaged" && state.triagedBy) return texts.alreadyTriagedBy(state.triagedBy);
  if (state.error === "machine-retired") return texts.retiredMeanwhile(museumNumber);
  return commandErrorText(teamMessages, state.error);
}

import { rejectionText } from "@/app/_actions/rejection-text";
import { teamMessages, type TeamCommandErrorCode } from "@/platform/messages";

const { machines } = teamMessages.maintenancePlan;

/**
 * A rejected „Wartungsaufgabe hinzufügen“ in words (ST-094): the shared text for the error – naming the machines retired
 * meanwhile, and saying for an unknown machine that nothing was stored. Its own file, without server code: the client
 * form imports it.
 */
export function addRejectionText(state: { error: TeamCommandErrorCode; retired?: readonly string[] }): string {
  return rejectionText(state.error, {
    "machine-retired": state.retired?.length ? machines.retiredMeanwhile(state.retired) : undefined,
    "unknown-machine": machines.unknown,
  });
}

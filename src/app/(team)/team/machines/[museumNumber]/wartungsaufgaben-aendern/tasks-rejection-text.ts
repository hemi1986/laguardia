import { rejectionText } from "@/app/_actions/rejection-text";
import { teamMessages, type TeamCommandErrorCode } from "@/platform/messages";

const { changeTasks: texts } = teamMessages;

/**
 * A rejected „Wartungsaufgaben ändern“ in words (ST-096): the shared text for the error – naming the maintenance tasks
 * removed meanwhile, and saying for an unknown one that nothing was stored. Its own file, without server code: the client
 * form imports it.
 */
export function tasksRejectionText(state: { error: TeamCommandErrorCode; removed?: readonly string[] }): string {
  return rejectionText(state.error, {
    "maintenance-task-removed": state.removed?.length ? texts.removedMeanwhile(state.removed) : undefined,
    "maintenance-task-unknown": texts.unknown,
  });
}

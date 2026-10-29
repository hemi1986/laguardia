import { rejectionText } from "@/app/_actions/rejection-text";
import { teamMessages, type TeamCommandErrorCode } from "@/platform/messages";

const { changeTasks: texts } = teamMessages;

/**
 * A rejected choice of a machine's maintenance tasks in words (ST-096, ST-097 – „Wartungsaufgaben ändern“ and the
 * registration): the shared text for the error – naming the maintenance tasks removed meanwhile, and saying for an
 * unknown one that nothing was stored. Its own file, without server code: the client forms import it.
 */
export function tasksRejectionText(state: { error: TeamCommandErrorCode; removed?: readonly string[] }): string {
  return rejectionText(state.error, {
    "maintenance-task-removed": state.removed?.length ? texts.removedMeanwhile(state.removed) : undefined,
    "maintenance-task-unknown": texts.unknown,
  });
}

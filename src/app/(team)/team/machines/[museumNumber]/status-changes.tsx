import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { NamedStatusChange } from "./machine-record-data";

const { machineRecord: texts, machines } = teamMessages;

/**
 * Status changes, the newest first, as the machine record (section 6) and the status history page list them (ST-093):
 * the first entry is the registration, every other one says from which status to which, why, who and when.
 */
export function StatusChangeList({ changes }: { changes: NamedStatusChange[] }) {
  return (
    <ol className="flex flex-col gap-3 [overflow-wrap:anywhere]">
      {changes.map((change) => (
        <li key={change.id} className="flex flex-col gap-0.5 text-sm">
          <StatusChangeEntry change={change} />
        </li>
      ))}
    </ol>
  );
}

function StatusChangeEntry({ change }: { change: NamedStatusChange }) {
  const who = change.changedBy;
  const when = formatDateTime(change.changedAt);
  if (!change.previousStatus) {
    return (
      <>
        <span className="font-medium">{texts.registeredAs(machines.statuses[change.newStatus])}</span>
        <span className="text-muted-foreground">
          {who} · {when}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="font-medium">
        {machines.statuses[change.previousStatus]} → {machines.statuses[change.newStatus]}
      </span>
      <span className="text-muted-foreground">
        {change.reason} · {who} · {when}
      </span>
    </>
  );
}

import Link from "next/link";
import { Confirmation } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { reporterName } from "../reporter";
import { ProblemReportPhoto } from "../problem-report-photo";
import type {
  DefectRecordedConfirmation,
  LinkedConfirmation,
  TriagedConfirmation,
  TriageListItem,
} from "./triage-list-data";

const { triage: texts, recordDefect, resolveOnTheSpot, dismiss, link, machines } = teamMessages;

/**
 * The triage list (RM-TriageList, ST-017): every untriaged problem report, the oldest first. An entry shows its
 * machine, description, reporter and waiting time and leads to the problem report's own page, where it is triaged
 * (G5). How many wait – or that nothing does – is said in words (G6, G7); so is a long wait (G6a). Report texts are
 * plain text: React escapes them, nothing is interpreted.
 */
export function TriageListView({
  data,
  defectRecorded,
  resolvedOnTheSpot,
  dismissed,
  linked,
}: {
  data: { entries: TriageListItem[] };
  /** Just back from recording a defect (ST-018): the confirmation names it, its machine and its new status (G3). */
  defectRecorded?: DefectRecordedConfirmation;
  /** Just back from resolving a problem on the spot (ST-019): the confirmation names the machine (G3). */
  resolvedOnTheSpot?: TriagedConfirmation;
  /** Just back from dismissing a problem report (ST-020): the confirmation names the machine (G3). */
  dismissed?: TriagedConfirmation;
  /** Just back from linking a problem report (ST-022): the confirmation names the machine and the defect (G3). */
  linked?: LinkedConfirmation;
}) {
  const { entries } = data;
  const confirmation =
    (defectRecorded && (
      <Confirmation>
        {recordDefect.recorded(defectRecorded.title, defectRecorded.museumNumber)}
        {defectRecorded.newStatus &&
          recordDefect.statusNow(defectRecorded.museumNumber, machines.statuses[defectRecorded.newStatus])}
      </Confirmation>
    )) ||
    (resolvedOnTheSpot && <Confirmation>{resolveOnTheSpot.resolved(resolvedOnTheSpot.museumNumber)}</Confirmation>) ||
    (dismissed && <Confirmation>{dismiss.dismissed(dismissed.museumNumber)}</Confirmation>) ||
    (linked && <Confirmation>{link.linked(linked.museumNumber, linked.title)}</Confirmation>);
  if (entries.length === 0) {
    return (
      <>
        {confirmation}
        <p>{texts.nothing}</p>
      </>
    );
  }
  return (
    <>
      {confirmation}
      <p>{texts.waiting(entries.length)}</p>
      <ol className="flex flex-col gap-4 [overflow-wrap:anywhere]">
        {entries.map((entry) => (
          <li key={entry.id}>
            <article className="flex flex-col gap-1 text-sm">
              <Link href={`/team/triage/${entry.id}`} className="font-medium underline underline-offset-4">
                {entry.museumNumber} · {entry.machineModelTitle}
              </Link>
              <p>{entry.description}</p>
              {entry.photo && <ProblemReportPhoto address={entry.photo.address} />}
              <p className="text-muted-foreground">
                {reporterName(entry.reporter)} · {formatDateTime(entry.reportedAt)} ·{" "}
                {texts.waitingFor(entry.waitingHours)}
              </p>
              {entry.waitingLong && <p className="font-medium">{texts.longWait}</p>}
            </article>
          </li>
        ))}
      </ol>
    </>
  );
}

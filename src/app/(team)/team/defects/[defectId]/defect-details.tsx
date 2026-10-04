import Link from "next/link";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { reporterName } from "../../triage/triage-list";
import type { DefectDetailsData } from "./defect-details-data";

const { defects: texts, recordDefect, terms } = teamMessages;

/**
 * A defect's own page (ST-021): its machine – leading to the machine record –, title, priority, whether it is suitable
 * for helpers and how long it is open, then the problem reports it came from: the originating one first, then the
 * linked ones (ST-022). Work log entries (ST-024) and photos (ST-016) are added by their stories. Texts are plain text.
 */
export function DefectDetailsView({ details }: { details: DefectDetailsData | undefined }) {
  if (!details) {
    return (
      <div className="flex flex-col gap-2">
        <p>{texts.unknown}</p>
        <Link href="/team/defects" className="self-start underline underline-offset-4">
          {texts.back}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6 [overflow-wrap:anywhere]">
      <section className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{details.title}</h2>
        <Link href={`/team/machines/${details.museumNumber}`} className="self-start underline underline-offset-4">
          {details.museumNumber} · {details.machineModelTitle}
        </Link>
        <p className="text-sm">{texts.priority(recordDefect.priorities[details.priority])}</p>
        <p className="text-sm">
          {details.suitableForHelpers ? terms["Suitable for helpers"] : texts.notSuitableForHelpers}
        </p>
        <p className="text-muted-foreground text-sm">
          {texts.recordedAt(formatDateTime(details.openSince))} · {texts.openFor(details.openDays)}
        </p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{texts.problemReports}</h2>
        <ol className="flex flex-col gap-4">
          {details.problemReports.map((report) => (
            <li key={report.id}>
              <article className="flex flex-col gap-1 text-sm">
                <p className="font-medium">{report.originating ? texts.originating : texts.linked}</p>
                <p>{report.description}</p>
                <p className="text-muted-foreground">
                  {reporterName(report.reporter)} · {formatDateTime(report.reportedAt)}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </section>
      <Link href="/team/defects" className="self-start underline underline-offset-4">
        {texts.back}
      </Link>
    </div>
  );
}

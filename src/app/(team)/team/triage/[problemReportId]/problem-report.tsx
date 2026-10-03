import Link from "next/link";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { reporterName } from "../triage-list";
import type { ProblemReportData } from "./problem-report-data";

const { triage: texts, terms } = teamMessages;

/**
 * A problem report's own page (ST-017) – where it is triaged. ST-017 owns the page (G18): the machine, the description,
 * who reported it and how long it has been waiting. The triage stories add their outcomes below, each for whom it is
 * allowed (ST-018 record defect, ST-019 resolve on the spot, ST-020 dismiss, ST-022 link) – no outcome before them.
 */
export function ProblemReportView({ data }: { data: ProblemReportData }) {
  if (!data) {
    return (
      <>
        <p>{texts.unknown}</p>
        <BackToTriage />
      </>
    );
  }
  const { report, triaged } = data;
  const details: [string, string][] = [
    [terms.Machine, `${report.museumNumber} · ${report.machineModelTitle}`],
    [texts.reportedBy, reporterName(report.reporter)],
    [texts.reportedAt, formatDateTime(report.reportedAt)],
  ];

  return (
    <>
      {triaged && <p className="font-medium">{texts.alreadyTriaged}</p>}
      <p className="whitespace-pre-line [overflow-wrap:anywhere]">{report.description}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm [overflow-wrap:anywhere]">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {!triaged && (
        <p className="text-sm">
          {texts.waitingFor(report.waitingHours)}
          {report.waitingLong && <span className="font-medium"> · {texts.longWait}</span>}
        </p>
      )}
      <BackToTriage />
    </>
  );
}

function BackToTriage() {
  return (
    <Link href="/team/triage" className="self-start text-sm underline underline-offset-4">
      {texts.back}
    </Link>
  );
}

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Role } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import { reporterName } from "../../reporter";
import { ProblemReportPhoto } from "../../problem-report-photo";
import type { ProblemReportData } from "./problem-report-data";

const { triage: texts, terms } = teamMessages;

/**
 * A problem report's own page (ST-017) – where it is triaged. ST-017 owns the page (G18): the machine, the description,
 * who reported it and how long it has been waiting. The triage stories add their outcomes below, each for whom it is
 * allowed (ST-018 record defect, ST-019 resolve on the spot, ST-020 dismiss, ST-022 link) – no outcome before them.
 */
export function ProblemReportView({ data, role }: { data: ProblemReportData; role: Role }) {
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
      {report.photo && <ProblemReportPhoto address={report.photo.address} />}
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
      {!triaged && <TriageOutcomes problemReportId={report.id} role={role} />}
      <BackToTriage />
    </>
  );
}

/**
 * The triage outcomes the person may choose (G21, story review 2026-10-03): each a button to its own form page, in the
 * order Mit Defekt verknüpfen (ST-022), Defekt erfassen (ST-018), Direkt behoben (ST-019), Meldung verwerfen (ST-020).
 * Technician-only outcomes are not shown to helpers (G11); the commands refuse them anyway.
 */
function TriageOutcomes({ problemReportId, role }: { problemReportId: string; role: Role }) {
  const outcomes = role === "technician" ? [{ href: "defekt-erfassen", label: texts.recordDefect }] : [];
  if (outcomes.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{texts.outcomes}</h2>
      <div className="flex flex-wrap gap-2">
        {outcomes.map((outcome) => (
          <Link
            key={outcome.href}
            href={`/team/triage/${problemReportId}/${outcome.href}`}
            className={buttonVariants({ variant: "outline" })}
          >
            {outcome.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function BackToTriage() {
  return (
    <Link href="/team/triage" className="self-start text-sm underline underline-offset-4">
      {texts.back}
    </Link>
  );
}

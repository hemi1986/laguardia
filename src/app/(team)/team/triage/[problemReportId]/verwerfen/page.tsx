import Link from "next/link";
import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { ProblemReportDescription } from "../problem-report-description";
import { requireTechnician } from "../../../../../team-session";
import { loadProblemReport } from "../problem-report-data";
import { dismissAction } from "./actions";
import { DismissForm } from "./dismiss-form";

const { dismiss: texts, triage } = teamMessages;

/**
 * „Meldung verwerfen“ (ST-020) – the form page of one triage outcome (G21): it repeats the machine and the description,
 * and lands on the triage list. Technicians only (helpers are sent away; the command refuses them anyway).
 */
export default async function DismissPage({ params }: PageProps<"/team/triage/[problemReportId]/verwerfen">) {
  await requireTechnician();
  const { problemReportId } = await params;
  const data = await loadProblemReport(database(), systemClock, problemReportId);
  const museumNumber = data?.report.museumNumber ?? "";

  return (
    <Page title={data ? texts.title(museumNumber) : teamMessages.terms["Problem report"]}>
      {!data ? (
        <p>{triage.unknown}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {museumNumber} · {data.report.machineModelTitle}
          </p>
          <ProblemReportDescription report={data.report} dismissedAsSpam={data.dismissedAsSpam} />
          {/* Rendered for a triaged problem report too: an action re-renders this page (the session cookie is renewed),
              and a rejection because someone triaged first must keep the form and what was chosen (ST-019 review). */}
          <DismissForm
            action={dismissAction.bind(null, problemReportId)}
            version={data.version}
            triaged={data.triaged}
            museumNumber={museumNumber}
          />
        </>
      )}
      <Link href={`/team/triage/${problemReportId}`} className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

import Link from "next/link";
import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { ProblemReportDescription } from "../problem-report-description";
import { requireTechnician } from "../../../../../team-session";
import { loadProblemReport } from "../problem-report-data";
import { linkToDefectAction } from "./actions";
import { LinkToDefectForm } from "./link-to-defect-form";

const { link: texts, triage } = teamMessages;

/**
 * „Mit Defekt verknüpfen“ (ST-022) – the form page of one triage outcome (G21): it repeats the machine and the
 * description, offers the machine's open defects and lands on the triage list. Technicians only (helpers are sent away;
 * the command refuses them anyway).
 */
export default async function LinkToDefectPage({ params }: PageProps<"/team/triage/[problemReportId]/verknuepfen">) {
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
          {!data.triaged && data.openDefects.length === 0 && <p>{texts.noOpenDefects(museumNumber)}</p>}
          {/* Rendered for a triaged problem report too: an action re-renders this page (the session cookie is renewed),
              and a rejection because someone triaged first must keep the form and the rejection (ST-019 review). */}
          <LinkToDefectForm
            action={linkToDefectAction.bind(null, problemReportId)}
            version={data.version}
            triaged={data.triaged}
            openDefects={data.openDefects}
          />
        </>
      )}
      <Link href={`/team/triage/${problemReportId}`} className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

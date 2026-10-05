import Link from "next/link";
import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadProblemReport } from "../problem-report-data";
import { resolveOnTheSpotAction } from "./actions";
import { ResolveOnTheSpotForm } from "./resolve-on-the-spot-form";

const { resolveOnTheSpot: texts, triage } = teamMessages;

/**
 * „Direkt behoben“ (ST-019) – the form page of one triage outcome (G21): it repeats the machine and the description,
 * and lands on the triage list. Every team member – helpers use the triage list only for this outcome.
 */
export default async function ResolveOnTheSpotPage({
  params,
}: PageProps<"/team/triage/[problemReportId]/direkt-behoben">) {
  await requireTeamMember();
  const { problemReportId } = await params;
  const data = await loadProblemReport(database(), systemClock, problemReportId);

  return (
    <Page title={data ? texts.title(data.report.museumNumber) : teamMessages.terms["Problem report"]}>
      {!data ? (
        <p>{triage.unknown}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {data.report.museumNumber} · {data.report.machineModelTitle}
          </p>
          <p className="[overflow-wrap:anywhere] whitespace-pre-line">{data.report.description}</p>
          {/* Rendered for a triaged problem report too: an action re-renders this page (the session cookie is renewed),
              and a rejection because someone triaged first must keep the form and the note (ST-019). */}
          <ResolveOnTheSpotForm
            action={resolveOnTheSpotAction.bind(null, problemReportId)}
            version={data.version}
            triaged={data.triaged}
          />
        </>
      )}
      <Link href={`/team/triage/${problemReportId}`} className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

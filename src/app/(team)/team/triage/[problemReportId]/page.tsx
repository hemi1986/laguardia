import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { loadProblemReport } from "./problem-report-data";
import { ProblemReportView } from "./problem-report";

/** A problem report's own page (ST-017), opened from the triage list – where it is triaged (ST-018 ff.). */
export default async function ProblemReportPage({ params }: PageProps<"/team/triage/[problemReportId]">) {
  const member = await requireTeamMember();
  const { problemReportId } = await params;
  const data = await loadProblemReport(database(), systemClock, problemReportId);

  return (
    <Page title={teamMessages.terms["Problem report"]}>
      <ProblemReportView data={data} role={member.role} />
    </Page>
  );
}

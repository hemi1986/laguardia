import Link from "next/link";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { teamReportProblemAction } from "./actions";
import { TeamReportProblemForm } from "./report-problem-form";

const { machineRecord, reportProblem: texts } = teamMessages;

/**
 * A team member reports a problem from the machine record (ST-015) – a page of its own with nothing but the form
 * (G1, user 2026-10-03). Every team member may report, also for a machine not on display; not for a retired one.
 */
export default async function TeamReportProblemPage({ params }: PageProps<"/team/machines/[museumNumber]/melden">) {
  await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const machine = await machineForTeamForm(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : machine.retired ? (
        <p>{texts.retired}</p>
      ) : (
        <TeamReportProblemForm action={teamReportProblemAction.bind(null, museumNumber)} />
      )}
      <Link
        href={`/team/machines/${encodeURIComponent(museumNumber)}`}
        className="self-start text-sm underline underline-offset-4"
      >
        {texts.back}
      </Link>
    </Page>
  );
}

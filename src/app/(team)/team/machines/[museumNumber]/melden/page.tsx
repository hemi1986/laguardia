import { anythingToLinkTo } from "../../../defect-to-link-to-input";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { named } from "../../../named";
import { defectsToLinkTo } from "@/modules/repair";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { teamReportProblemAction } from "./actions";
import { TeamReportProblemForm } from "./report-problem-form";
import { TriageChoice } from "./triage-choice";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";
import { BackToMachine } from "../machine-history";

const { machineRecord, reportProblem: texts } = teamMessages;

/**
 * A team member reports a problem from the machine record (ST-015) – a page of its own with nothing but the form
 * (G1, user 2026-10-03). Every team member may report, also for a machine not on display; not for a retired one.
 * A technician's own problem report is triaged in the same step (ST-023, G21a): instead of the form the technician
 * chooses the triage outcome here, and its form page takes the problem report too. A helper's form leads to resolving
 * on the spot in the same step, the one triage outcome a helper may choose (ST-052, H2).
 */
export default async function TeamReportProblemPage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/melden">) {
  const member = await requireTeamMember();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("melden"));
  const db = database();
  const machine = await machineForTeamForm(db, museumNumber);
  const technician = member.role === "technician";
  // Only the technician's choice page names the machine model and needs to know whether there is a defect to link to.
  const [label, canLink] =
    machine && technician
      ? await Promise.all([
          named(db, { machines: [machine.id] }).then(({ label }) => label(machine.id)),
          // Open or recently resolved defects (ST-053).
          defectsToLinkTo(db, systemClock, machine.id).then(anythingToLinkTo),
        ])
      : [undefined, false];
  const triageRequired = (await searchParams).triageRequired !== undefined;

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : machine.retired ? (
        <p>{texts.retired}</p>
      ) : technician ? (
        <TriageChoice
          museumNumber={museumNumber}
          machineModelTitle={label?.machineModelTitle ?? ""}
          canLink={canLink}
          triageRequired={triageRequired}
        />
      ) : (
        <TeamReportProblemForm
          action={teamReportProblemAction.bind(null, museumNumber)}
          resolveOnTheSpot={`/team/machines/${encodeURIComponent(museumNumber)}/melden/direkt-behoben`}
        />
      )}
      <BackToMachine museumNumber={museumNumber} />
    </Page>
  );
}

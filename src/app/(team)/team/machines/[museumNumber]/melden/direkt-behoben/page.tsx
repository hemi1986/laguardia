import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { named } from "../../../../named";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../../team-session";
import { reportAndResolveAction } from "./actions";
import { ReportAndResolveForm } from "./report-and-resolve-form";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";

const { machineRecord, reportAndResolveOnTheSpot: texts, reportProblem } = teamMessages;

/**
 * „Problem melden und als direkt behoben eintragen“ (ST-052, G21a) – the form page of the triage outcome *resolved on
 * the spot* chosen when reporting: a technician reaches it from „Sichten“, a helper from „Schon selbst behoben?“ on
 * the plain report form (H2). Back on the machine record afterwards.
 */
export default async function ReportAndResolvePage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/melden/direkt-behoben">) {
  await requireTeamMember();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("melden/direkt-behoben"));
  const db = database();
  const machine = await machineForTeamForm(db, museumNumber);
  const label = machine && (await named(db, { machines: [machine.id] })).label(machine.id);

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {museumNumber} · {label?.machineModelTitle}
          </p>
          {/* Rendered for a retired machine too: an action re-renders this page, and a rejection because the machine
              was retired meanwhile must keep the form and what was typed (ST-019 review). */}
          <ReportAndResolveForm
            action={reportAndResolveAction.bind(null, museumNumber)}
            museumNumber={museumNumber}
            retired={machine.retired}
          />
        </>
      )}
      <BackLink href={`/team/machines/${encodeURIComponent(museumNumber)}`}>{reportProblem.back}</BackLink>
    </Page>
  );
}

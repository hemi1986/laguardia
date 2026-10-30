import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { MoveMachineForm } from "./move-machine-form";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";

const { machineRecord, machineMove: texts } = teamMessages;

/**
 * Moving a machine (ST-034) – its own page „Standort ändern · LG-042“, reached from the machine record. Every team
 * member may open it; the form is filled in with the current location.
 */
export default async function MoveMachinePage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/standort">) {
  await requireTeamMember();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("standort"));
  const machine = await machineForTeamForm(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : machine.retired ? (
        <p>{texts.retired}</p>
      ) : (
        <MoveMachineForm
          machineId={machine.id}
          museumNumber={machine.museumNumber}
          version={machine.version}
          location={machine.location}
        />
      )}
      <BackLink href={`/team/machines/${encodeURIComponent(museumNumber)}`}>{texts.back}</BackLink>
    </Page>
  );
}

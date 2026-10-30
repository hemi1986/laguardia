import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { retireMachineAction } from "./actions";
import { RetireMachineForm } from "./retire-machine-form";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";

const { machineRecord, machineRetire: texts } = teamMessages;

/**
 * Retiring a machine (ST-039) – its own page „Ausmustern · LG-013“, reached from section 9 of the machine record.
 * Technicians only (helpers are sent away; the command refuses them anyway).
 */
export default async function RetireMachinePage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/ausmustern">) {
  await requireTechnician();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("ausmustern"));
  const machine = await machineForTeamForm(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : (
        // Rendered for a retired machine too: an action re-renders this page, and a rejection because the machine was
        // retired meanwhile must keep the form and what was typed (ST-019 review).
        <RetireMachineForm
          action={retireMachineAction.bind(null, machine.museumNumber)}
          machineId={machine.id}
          museumNumber={machine.museumNumber}
          version={machine.version}
          retired={machine.retired}
        />
      )}
      <BackLink href={`/team/machines/${encodeURIComponent(museumNumber)}`}>
        {teamMessages.machineHistory.backToMachine}
      </BackLink>
    </Page>
  );
}

import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { correctDetailsRefusal, machineForTeamForm } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { CorrectDetailsForm } from "./correct-details-form";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";

const { machineRecord, machineCorrection: texts } = teamMessages;

/**
 * Correcting a machine's details (ST-035) – its own page „Angaben korrigieren · LG-042“, reached from the machine
 * record's section 3. The form is filled in with the museum number and the serial number; someone the command would
 * refuse sees the reason instead (G11).
 */
export default async function CorrectDetailsPage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/angaben">) {
  const member = await requireTeamMember();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("angaben"));
  const machine = await machineForTeamForm(database(), museumNumber);
  const refusal = machine && correctDetailsRefusal(machine, member);

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : refusal === "machine-retired" ? (
        <p>{texts.retired}</p>
      ) : refusal === "not-authorized" ? (
        <p>{texts.notAuthorized}</p>
      ) : (
        <CorrectDetailsForm
          machineId={machine.id}
          version={machine.version}
          museumNumber={machine.museumNumber}
          serialNumber={machine.serialNumber ?? ""}
        />
      )}
      <BackLink href={`/team/machines/${encodeURIComponent(museumNumber)}`}>{texts.back}</BackLink>
    </Page>
  );
}

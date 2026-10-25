import Link from "next/link";
import { Page } from "@/components/page";
import { correctDetailsRefusal, machineForTeamForm } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { CorrectDetailsForm } from "./correct-details-form";

const { machineRecord, machineCorrection: texts } = teamMessages;

/**
 * Correcting a machine's details (ST-035) – its own page „Angaben von LG-042 korrigieren“, reached from the machine
 * record's section 3. The form is filled in with the museum number and the serial number; someone the command would
 * refuse sees the reason instead (G11).
 */
export default async function CorrectDetailsPage({ params }: PageProps<"/team/machines/[museumNumber]/angaben">) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
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
      <Link
        href={`/team/machines/${encodeURIComponent(museumNumber)}`}
        className="self-start text-sm underline underline-offset-4"
      >
        {texts.back}
      </Link>
    </Page>
  );
}

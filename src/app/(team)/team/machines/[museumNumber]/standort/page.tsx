import Link from "next/link";
import { Page } from "@/components/page";
import { machineForTeamForm } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { MoveMachineForm } from "./move-machine-form";

const { machineRecord, machineMove: texts } = teamMessages;

/**
 * Moving a machine (ST-034) – its own page „Standort von LG-042 ändern“, reached from the machine record. Every team
 * member may open it; the form is filled in with the current location.
 */
export default async function MoveMachinePage({ params }: PageProps<"/team/machines/[museumNumber]/standort">) {
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
        <MoveMachineForm
          machineId={machine.id}
          museumNumber={machine.museumNumber}
          version={machine.version}
          location={machine.location}
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

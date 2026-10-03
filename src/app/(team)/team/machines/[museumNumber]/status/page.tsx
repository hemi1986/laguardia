import Link from "next/link";
import { Page } from "@/components/page";
import { machineForTeamForm, machineStatusesToChangeTo } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { ChangeMachineStatusForm } from "./change-machine-status-form";

const { machines, machineRecord, machineStatusChange: texts } = teamMessages;

/**
 * Changing a machine's status (ST-012) – its own page (G1, user 2026-10-03), reached from the machine record. Every
 * team member may open it; the form offers the machine statuses they can change the machine to.
 */
export default async function ChangeMachineStatusPage({ params }: PageProps<"/team/machines/[museumNumber]/status">) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const machine = await machineForTeamForm(database(), museumNumber);
  const offered = machine ? machineStatusesToChangeTo(member.role, machine) : [];

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : machine.retired ? (
        <p>{texts.retired}</p>
      ) : offered.length === 0 ? (
        // A helper on a machine that is already Out of order – nothing they may set (G11, user 2026-10-03).
        <p>{texts.nothingToChange(machines.statuses[machine.machineStatus])}</p>
      ) : (
        <>
          <p>{texts.current(machines.statuses[machine.machineStatus])}</p>
          <ChangeMachineStatusForm machineId={machine.id} version={machine.version} offered={offered} />
        </>
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

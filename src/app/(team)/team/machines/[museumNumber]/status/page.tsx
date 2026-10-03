import Link from "next/link";
import { Page } from "@/components/page";
import { machineForStatusChange, machineStatusesSettableBy } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { ChangeMachineStatusForm } from "./change-machine-status-form";

const { machines, machineRecord, machineStatusChange: texts } = teamMessages;

/**
 * Changing a machine's status (ST-012) – its own page (G1, user 2026-10-03), reached from the machine record. Every
 * team member may open it; the form offers the machine statuses their role may set.
 */
export default async function ChangeMachineStatusPage({ params }: { params: Promise<{ museumNumber: string }> }) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const machine = await machineForStatusChange(database(), museumNumber);

  return (
    <Page title={texts.title(museumNumber)}>
      {!machine ? (
        <p>{machineRecord.unknown(museumNumber)}</p>
      ) : machine.retired ? (
        <p>{texts.retired}</p>
      ) : (
        <>
          <p>{texts.current(machines.statuses[machine.machineStatus])}</p>
          <ChangeMachineStatusForm
            machineId={machine.id}
            version={machine.version}
            offered={machineStatusesSettableBy(member.role)}
          />
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

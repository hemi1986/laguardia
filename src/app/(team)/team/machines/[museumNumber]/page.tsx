import { redirect } from "next/navigation";
import { Page } from "@/components/page";
import { machineOfMuseumNumber } from "@/modules/collection";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { loadMachineConfirmation } from "./machine-confirmation";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";

/**
 * The machine record of one machine, addressed by its museum number (ST-009) – where the QR sticker leads team
 * members (ST-011). Every team member sees it; a reserved museum number redirects to the current one (ST-035).
 */
export default async function MachineRecordPage({ params, searchParams }: PageProps<"/team/machines/[museumNumber]">) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const [record, query] = await Promise.all([
    loadMachineRecord(database(), museumNumber, { clock: systemClock, viewer: member }),
    searchParams,
  ]);
  if (!record) {
    // A reserved museum number leads to the machine under its current one – an old QR sticker keeps working (ST-035).
    const machine = await machineOfMuseumNumber(database(), museumNumber);
    if (machine && machine.museumNumber !== museumNumber) {
      redirect(`/team/machines/${encodeURIComponent(machine.museumNumber)}`);
    }
  }
  const confirmation = record && (await loadMachineConfirmation(database(), systemClock, member.id, record, query));

  return (
    <Page title={record ? `${record.museumNumber} · ${record.machineModel.title}` : teamMessages.terms.Machine}>
      <MachineRecordView record={record} museumNumber={museumNumber} confirmation={confirmation} />
    </Page>
  );
}

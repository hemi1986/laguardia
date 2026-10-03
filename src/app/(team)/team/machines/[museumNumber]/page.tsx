import { Page } from "@/components/page";
import { machineStatusesSettableBy } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";

/**
 * The machine record of one machine, addressed by its museum number (ST-009) – where the QR sticker leads team
 * members (ST-011). Every team member sees it.
 */
export default async function MachineRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ museumNumber: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const record = await loadMachineRecord(database(), museumNumber);

  return (
    <Page title={record ? `${record.museumNumber} · ${record.machineModel.title}` : teamMessages.terms.Machine}>
      <MachineRecordView
        record={record}
        museumNumber={museumNumber}
        canChangeStatus={
          !!record &&
          !record.retirement &&
          machineStatusesSettableBy(member.role).some((status) => status !== record.machineStatus)
        }
        statusChanged={(await searchParams).statusChanged !== undefined}
      />
    </Page>
  );
}

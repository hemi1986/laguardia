import { Page } from "@/components/page";
import { machineStatusesToChangeTo } from "@/modules/collection";
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
}: PageProps<"/team/machines/[museumNumber]">) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const [record, query] = await Promise.all([loadMachineRecord(database(), museumNumber), searchParams]);

  return (
    <Page title={record ? `${record.museumNumber} · ${record.machineModel.title}` : teamMessages.terms.Machine}>
      <MachineRecordView
        record={record}
        museumNumber={museumNumber}
        canChangeStatus={
          !!record &&
          machineStatusesToChangeTo(member.role, {
            machineStatus: record.machineStatus,
            retired: record.retirement !== undefined,
          }).length > 0
        }
        statusChanged={query.statusChanged !== undefined}
        problemReported={query.problemReported !== undefined}
      />
    </Page>
  );
}

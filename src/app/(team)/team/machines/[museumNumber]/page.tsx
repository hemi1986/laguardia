import { Page } from "@/components/page";
import { machineStatusesToChangeTo } from "@/modules/collection";
import { defectTitle } from "@/modules/repair";
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
  // Just back from reporting a problem and recording a defect in the same step (ST-023): the confirmation names what
  // is stored – the defect of the address, only when it is this machine's, and the machine's status now.
  const defectId = typeof query.defectRecorded === "string" ? query.defectRecorded : undefined;
  const recorded = record && defectId ? await defectTitle(database(), defectId) : undefined;
  const defectRecorded =
    record && recorded?.machineId === record.id
      ? {
          title: recorded.title,
          museumNumber: record.museumNumber,
          newStatus: query.statusChanged !== undefined ? record.machineStatus : undefined,
        }
      : undefined;

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
        statusChanged={query.statusChanged !== undefined && !defectRecorded}
        defectRecorded={defectRecorded}
        problemReported={query.problemReported !== undefined}
      />
    </Page>
  );
}

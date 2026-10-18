import { Page } from "@/components/page";
import { machineStatusesToChangeTo } from "@/modules/collection";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";
import { loadTriagedWhenReporting } from "./triaged-when-reporting";

/**
 * The machine record of one machine, addressed by its museum number (ST-009) – where the QR sticker leads team
 * members (ST-011). Every team member sees it.
 */
export default async function MachineRecordPage({ params, searchParams }: PageProps<"/team/machines/[museumNumber]">) {
  const member = await requireTeamMember();
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const [record, query] = await Promise.all([
    loadMachineRecord(database(), museumNumber, { clock: systemClock, viewer: member }),
    searchParams,
  ]);
  // Just back from reporting a problem and triaging it in the same step (ST-023, ST-052).
  const triagedWhenReporting = record && (await loadTriagedWhenReporting(database(), systemClock, record, query));

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
        statusChanged={query.statusChanged !== undefined && !triagedWhenReporting}
        moved={query.moved !== undefined && !triagedWhenReporting}
        triagedWhenReporting={triagedWhenReporting}
        problemReported={query.problemReported !== undefined}
      />
    </Page>
  );
}

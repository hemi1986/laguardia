import { Page } from "@/components/page";
import { machineStatuses, type MachineStatus } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { MachineOverview } from "./machine-overview";
import { loadMachineOverview } from "./machine-overview-data";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The machine overview (ST-007, ST-008) – every team member sees it; registering is for technicians (G11). Each
 * machine shows its open defects (ST-021).
 */
export default async function MachinesPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireTeamMember();
  const params = await searchParams;
  const query = { search: single(params.search), machineStatus: statusOf(single(params.machineStatus)) };
  const { machines, counts } = await loadMachineOverview(database(), query);
  const registered = single(params.registered);

  return (
    <Page title={teamMessages.machines.title} wide>
      <MachineOverview
        machines={machines}
        counts={counts}
        query={query}
        canRegister={member.role === "technician"}
        registered={registered ? machines.find((machine) => machine.id === registered) : undefined}
      />
    </Page>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** An unknown machine status in the address filters nothing – the overview shows all machines. */
function statusOf(value: string | undefined): MachineStatus | undefined {
  return machineStatuses.find((status) => status === value);
}

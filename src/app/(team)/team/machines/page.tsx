import { Page } from "@/components/page";
import { fileRemovedBy, machineRegisteredIn, machineStatuses, type MachineStatus } from "@/modules/collection";
import { systemClock } from "@/platform/clock";
import { lastCommandBy } from "@/platform/command";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { MachineOverview } from "./machine-overview";
import { loadMachineOverview } from "./machine-overview-data";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The machine overview (ST-007, ST-008) – every team member sees it; registering is for technicians (G11). Each
 * machine shows its open defects (ST-021) and overdue maintenance tasks (ST-057).
 */
export default async function MachinesPage({ searchParams }: { searchParams: SearchParams }) {
  const member = await requireTeamMember();
  const params = await searchParams;
  const query = {
    search: single(params.search),
    machineStatus: statusOf(single(params.machineStatus)),
    retired: single(params.retired) === "1",
  };
  const { machines, counts, retiredCount } = await loadMachineOverview(database(), systemClock, query);
  // Confirmed only when registering it was the latest command on it and this technician ran it (G3).
  const registeredId = single(params.registered);
  const registering = registeredId && (await lastCommandBy(database(), { aggregateId: registeredId }, member.id));
  const registered = registering && machineRegisteredIn(registering, registeredId) ? registeredId : undefined;
  // A file removed without a known origin lands here (ST-121), confirmed from the journal like any other action.
  const removedId = single(params.fileRemoved);
  const removed = removedId ? await fileRemovedBy(database(), removedId, member.id) : undefined;

  return (
    <Page title={teamMessages.machines.title}>
      <MachineOverview
        machines={machines}
        counts={counts}
        retiredCount={retiredCount}
        query={query}
        canRegister={member.role === "technician"}
        registered={registered ? machines.find((machine) => machine.id === registered) : undefined}
        removedFileTitle={removed?.title}
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

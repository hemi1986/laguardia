import { Page } from "@/components/page";
import { machineOverview } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { MachineOverview } from "./machine-overview";

/** The machine overview (ST-007) – every team member sees it; registering is for technicians (G11). */
export default async function MachinesPage({ searchParams }: { searchParams: Promise<{ registered?: string | string[] }> }) {
  const member = await requireTeamMember();
  const machines = await machineOverview(database());
  const { registered } = await searchParams;

  return (
    <Page title={teamMessages.machines.title}>
      <MachineOverview
        machines={machines}
        canRegister={member.role === "technician"}
        registered={machines.find((machine) => machine.id === registered)}
      />
    </Page>
  );
}

import Link from "next/link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { AddMaintenanceTaskForm } from "./add-maintenance-task-form";
import { loadAddMaintenanceTask } from "./add-maintenance-task-data";

const { maintenancePlan: texts } = teamMessages;

/** Adding a maintenance task (ST-040, ST-094) – a page with nothing but the form (G2a); technicians only (G11). */
export default async function AddMaintenanceTaskPage() {
  await requireTechnician();
  const data = await loadAddMaintenanceTask(database());

  return (
    <Page title={texts.add}>
      <AddMaintenanceTaskForm {...data} />
      <Link href="/team/maintenance-plan" className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

import Link from "next/link";
import { Page } from "@/components/page";
import { maintenancePlanVersion } from "@/modules/maintenance";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { maintenanceTaskChoices } from "../maintenance-task-choices";
import { AddMaintenanceTaskForm } from "./add-maintenance-task-form";

const { maintenancePlan: texts } = teamMessages;

/** Adding a maintenance task (ST-040) – a page with nothing but the form (G2a); technicians only (G11). */
export default async function AddMaintenanceTaskPage() {
  await requireTechnician();
  const version = await maintenancePlanVersion(database());

  return (
    <Page title={texts.add}>
      <AddMaintenanceTaskForm version={version} {...maintenanceTaskChoices} />
      <Link href="/team/maintenance-plan" className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

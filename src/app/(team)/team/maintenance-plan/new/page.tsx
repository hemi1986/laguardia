import Link from "next/link";
import { Page } from "@/components/page";
import { machineCategories, technologies, technologiesOf } from "@/modules/collection";
import { maintenancePlan } from "@/modules/maintenance";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { AddMaintenanceTaskForm, type Choices } from "./add-maintenance-task-form";

const { maintenancePlan: texts, machineModels } = teamMessages;

/** The choices of the form, with the German wording – the form itself knows no domain and no catalogue key. */
const choices: Choices = {
  machineCategories: machineCategories.map((category) => ({
    value: category,
    label: machineModels.categories[category],
  })),
  technologies: technologies.map((technology) => ({
    value: technology,
    // "LCD (Flipper, Arcade)" – the categories a technology fits, so the technician sees it without JavaScript.
    label: `${machineModels.technologies[technology]} (${machineCategories
      .filter((category) => technologiesOf(category).includes(technology))
      .map((category) => machineModels.categories[category])
      .join(", ")})`,
  })),
};

/** Adding a maintenance task (ST-040) – a page with nothing but the form (G2a); technicians only (G11). */
export default async function AddMaintenanceTaskPage() {
  await requireTechnician();
  const { version } = await maintenancePlan(database());

  return (
    <Page title={texts.add}>
      <AddMaintenanceTaskForm version={version} {...choices} />
      <Link href="/team/maintenance-plan" className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

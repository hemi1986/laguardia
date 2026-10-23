import { machineCategories, technologies, technologiesOf } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import type { Choices } from "./maintenance-task-fields";

const { machineModels } = teamMessages;

/** The choices of a maintenance task's form, with the German wording – the form itself knows no domain and no key. */
export const maintenanceTaskChoices: Choices = {
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

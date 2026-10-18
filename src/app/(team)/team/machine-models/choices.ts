import { machineCategories, technologies, technologiesOf } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import type { Choices } from "./machine-model-fields";

const { machineModels: texts } = teamMessages;

/**
 * What the machine model form's two selects offer, with the German wording – built on the server, so the client
 * forms import no module code (ST-006, ST-036).
 */
export const machineModelChoices: Choices = {
  categories: machineCategories.map((category) => ({ value: category, label: texts.categories[category] })),
  technologies: technologies.map((technology) => ({
    value: technology,
    // "LCD (Flipper, Arcade)" – the categories a technology fits, so the technician sees it without JavaScript.
    label: `${texts.technologies[technology]} (${machineCategories
      .filter((category) => technologiesOf(category).includes(technology))
      .map((category) => texts.categories[category])
      .join(", ")})`,
  })),
};

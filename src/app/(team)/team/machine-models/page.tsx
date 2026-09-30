import { Page } from "@/components/page";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { machineCategories, machineModelsToChooseFrom, technologiesOf, type MachineModel } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { CreateMachineModelForm, type MachineCategoryChoice } from "./create-machine-model-form";

const { machineModels: texts } = teamMessages;

/** The choices of the form, with the German wording – the form itself knows no domain and no catalogue key. */
const categoryChoices: MachineCategoryChoice[] = machineCategories.map((category) => ({
  value: category,
  label: texts.categories[category],
  technologies: technologiesOf(category).map((technology) => ({
    value: technology,
    label: texts.technologies[technology],
  })),
}));

/**
 * The machine models (ST-006): a technician creates one here, and sees the ones a machine can be registered for
 * (ST-007). Correcting one follows with ST-036, its manuals and schematics with ST-037.
 */
export default async function MachineModelsPage() {
  await requireTechnician();
  const models = await machineModelsToChooseFrom(database());

  return (
    <Page title={texts.title}>
      {models.length === 0 ? (
        <p>{texts.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {models.map((model) => (
            <li key={model.id}>
              <MachineModelCard model={model} />
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-medium">{texts.newMachineModel}</h2>
        <CreateMachineModelForm categories={categoryChoices} />
      </section>
    </Page>
  );
}

/** One machine model with everything the technician gave it – the year and the technology only when it has one. */
function MachineModelCard({ model }: { model: MachineModel }) {
  const details = [
    model.manufacturer,
    model.year,
    texts.categories[model.machineCategory],
    model.technology && texts.technologies[model.technology],
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{model.title}</CardTitle>
        <CardDescription>{details.join(" · ")}</CardDescription>
      </CardHeader>
    </Card>
  );
}

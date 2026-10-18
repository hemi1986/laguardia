import Link from "next/link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Confirmation } from "@/components/ui/message";
import { machineModelsToChooseFrom, type MachineModel } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";

const { machineModels: texts } = teamMessages;

/**
 * The machine models (ST-006): the ones a machine can be registered for (ST-007), each leading to its own page
 * (ST-036). „Neues Modell“ leads to the creation's own page (G2a); back from it, the new model is named (G3).
 */
export default async function MachineModelsPage({ searchParams }: PageProps<"/team/machine-models">) {
  await requireTechnician();
  const [models, { created }] = await Promise.all([machineModelsToChooseFrom(database()), searchParams]);
  const createdModel = models.find((model) => model.id === created);

  return (
    <Page title={texts.title}>
      <Link href="/team/machine-models/new" className={buttonVariants({ className: "self-start" })}>
        {texts.newMachineModel}
      </Link>
      {createdModel && <Confirmation>{texts.created(createdModel.title)}</Confirmation>}
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
        <CardTitle>
          <Link href={`/team/machine-models/${model.id}`} className="underline underline-offset-4">
            {model.title}
          </Link>
        </CardTitle>
        <CardDescription>{details.join(" · ")}</CardDescription>
      </CardHeader>
    </Card>
  );
}

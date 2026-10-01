import Link from "next/link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { machineModelsToChooseFrom, machineStatuses } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { RegisterMachineForm, type Choices } from "./register-machine-form";

const { machines: texts } = teamMessages;

/** Registering a machine (ST-007) – a page with nothing but the form (G2a); technicians only (G11). */
export default async function RegisterMachinePage() {
  await requireTechnician();
  const models = await machineModelsToChooseFrom(database());
  const choices: Choices = {
    // "Medieval Madness (Williams, 1997)" – the manufacturer and year tell models with the same title apart.
    machineModels: models.map((model) => ({
      value: model.id,
      label: `${model.title} (${[model.manufacturer, model.year].filter(Boolean).join(", ")})`,
    })),
    machineStatuses: machineStatuses.map((status) => ({ value: status, label: texts.statuses[status] })),
  };

  return (
    <Page title={texts.register}>
      {models.length === 0 ? (
        <>
          <p>{texts.noMachineModels}</p>
          <Link href="/team/machine-models" className={buttonVariants({ className: "self-start" })}>
            {texts.toMachineModels}
          </Link>
        </>
      ) : (
        <RegisterMachineForm {...choices} />
      )}
      <Link href="/team/machines" className="text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

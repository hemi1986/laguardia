import Link from "next/link";
import { Page } from "@/components/page";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { machineModelChoices } from "../choices";
import { CreateMachineModelForm } from "./create-machine-model-form";

const { machineModels: texts } = teamMessages;

/** Creating a machine model (ST-006) – a page of its own, without the list (ST-036, G2a). */
export default async function NewMachineModelPage() {
  await requireTechnician();

  return (
    <Page title={texts.newMachineModel}>
      <CreateMachineModelForm {...machineModelChoices} />
      <Link href="/team/machine-models" className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}

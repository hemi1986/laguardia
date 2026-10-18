import Link from "next/link";
import { Page } from "@/components/page";
import { machineModelForTeam } from "@/modules/collection";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { machineModelChoices } from "../../choices";
import { CorrectMachineModelForm } from "./correct-machine-model-form";

const { machineModels: texts, terms } = teamMessages;

/**
 * Correcting a machine model (ST-036) – its own page, reached from the machine model's page. It says how many machines
 * the correction applies to (retired ones included, user 2026-10-18).
 */
export default async function CorrectMachineModelPage({
  params,
}: PageProps<"/team/machine-models/[machineModelId]/korrigieren">) {
  await requireTechnician();
  const { machineModelId } = await params;
  const found = await machineModelForTeam(database(), machineModelId);

  return (
    <Page title={found ? texts.correctTitle(found.model.title) : terms["Machine model"]}>
      {!found ? (
        <p>{texts.unknown}</p>
      ) : (
        <>
          <p>{texts.appliesTo(found.machineCount)}</p>
          <CorrectMachineModelForm {...machineModelChoices} model={found.model} version={found.version} />
        </>
      )}
      <Link
        href={found ? `/team/machine-models/${found.model.id}` : "/team/machine-models"}
        className="self-start text-sm underline underline-offset-4"
      >
        {found ? texts.backToModel : texts.back}
      </Link>
    </Page>
  );
}

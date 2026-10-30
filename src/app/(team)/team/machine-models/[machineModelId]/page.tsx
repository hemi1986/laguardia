import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { machineModelChangeIn, machineModelForTeam } from "@/modules/collection";
import { lastCommandBy } from "@/platform/command";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";

const { machineModels: texts, terms } = teamMessages;

/**
 * A machine model's own page (ST-036), reached from its entry in the list: its details and „Modell korrigieren“. The
 * machine model pages are for technicians only (ST-006); its manuals and schematics follow with ST-037.
 */
export default async function MachineModelPage({
  params,
  searchParams,
}: PageProps<"/team/machine-models/[machineModelId]">) {
  const member = await requireTechnician();
  const [{ machineModelId }, { corrected: correctedAsked }] = await Promise.all([params, searchParams]);
  const found = await machineModelForTeam(database(), machineModelId);
  if (!found) {
    return (
      <Page title={terms["Machine model"]}>
        <p>{texts.unknown}</p>
        <BackToMachineModels />
      </Page>
    );
  }
  const { model } = found;
  // Confirmed only when correcting it was the latest command on it and this technician ran it (G3).
  const correcting =
    correctedAsked !== undefined
      ? await lastCommandBy(database(), { aggregateId: machineModelId }, member.id)
      : undefined;
  const corrected = correcting && machineModelChangeIn(correcting, machineModelId).corrected ? true : undefined;
  const details: [string, string][] = [
    [texts.modelTitle, model.title],
    [texts.manufacturer, model.manufacturer],
    [texts.year, model.year?.toString() ?? texts.noYear],
    [terms["Machine category"], texts.categories[model.machineCategory]],
    [terms.Technology, model.technology ? texts.technologies[model.technology] : texts.noTechnology],
  ];

  return (
    <Page title={model.title}>
      {corrected !== undefined && <Confirmation>{texts.corrected(model.title)}</Confirmation>}
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm [overflow-wrap:anywhere]">
        {details.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href={`/team/machine-models/${model.id}/korrigieren`}
        className={buttonVariants({ variant: "outline", className: "self-start" })}
      >
        {texts.correct}
      </Link>
      <BackToMachineModels />
    </Page>
  );
}

function BackToMachineModels() {
  return <BackLink href="/team/machine-models">{texts.back}</BackLink>;
}

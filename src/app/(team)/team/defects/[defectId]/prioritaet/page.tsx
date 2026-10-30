import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { prioritizeDefectAction } from "./actions";
import { loadDefectForPrioritizing } from "./prioritize-defect-data";
import { PrioritizeDefectForm } from "./prioritize-defect-form";

const { defects: texts, recordDefect } = teamMessages;

/**
 * „Priorität ändern“ (ST-027) – the form page of changing a defect's priority (G21, G22): it repeats the defect, its
 * machine and its priority now, and lands on the defect's page. Reached from „Verwalten“ by technicians; that only they
 * may prioritize, and only an open defect, is CMD-PrioritizeDefect's rule, shown here in place of the form (G11).
 */
export default async function PrioritizeDefectPage({ params }: PageProps<"/team/defects/[defectId]/prioritaet">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectForPrioritizing(database(), defectId, member);

  return (
    <Page title={details ? texts.prioritizeTitle(details.museumNumber) : teamMessages.terms.Defect}>
      {!details ? (
        <p>{texts.unknown}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{details.title}</h2>
            <p className="text-muted-foreground text-sm">
              {details.museumNumber} · {details.machineModelTitle}
            </p>
            <p className="text-sm">{texts.priority(recordDefect.priorities[details.priority])}</p>
          </div>
          <PrioritizeDefectForm
            action={prioritizeDefectAction.bind(null, details.id)}
            version={details.version}
            priorities={details.priorities}
            whyNot={details.whyNot}
          />
        </>
      )}
      <BackLink href={details ? `/team/defects/${details.id}` : "/team/defects"}>
        {details ? texts.backToDefect : texts.back}
      </BackLink>
    </Page>
  );
}

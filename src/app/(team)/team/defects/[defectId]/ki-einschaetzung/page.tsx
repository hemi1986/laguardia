import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { aiDependencies, defectAiAssessments } from "@/modules/ai-assistance";
import { machineLabels } from "@/modules/collection";
import { defectDetails } from "@/modules/repair";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { requestAiAssessmentAction } from "./actions";
import { RequestAiAssessmentForm } from "./request-form";

const { aiAssessments: texts, terms } = teamMessages;

/**
 * „KI-Einschätzung anfordern“ (ST-107) – the request form's own page (G2a), reached from the defect's section
 * „KI-Einschätzungen“ and back on the defect's page afterwards (G3). It repeats the defect and its machine (G34) and
 * shows CMD-RequestAiAssessment's reason in place of the form to someone it would refuse (G11).
 */
export default async function RequestAiAssessmentPage({
  params,
}: PageProps<"/team/defects/[defectId]/ki-einschaetzung">) {
  const member = await requireTeamMember();
  const { defectId } = await params;
  const db = database();
  const viewer = { teamMemberId: member.id, role: member.role };
  const [defect, section] = await Promise.all([
    defectDetails(db, defectId, viewer),
    defectAiAssessments(db, { defectId, viewer, dependencies: aiDependencies() }),
  ]);
  const label = defect && (await machineLabels(db, [defect.machineId])).get(defect.machineId);

  return (
    <Page title={defect ? texts.requestTitle(defect.title) : terms.Defect}>
      {!defect || !label ? (
        <p>{teamMessages.defects.unknown}</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{defect.title}</h2>
            <p className="text-muted-foreground text-sm">
              {label.museumNumber} · {label.machineModelTitle}
            </p>
          </div>
          <RequestAiAssessmentForm action={requestAiAssessmentAction.bind(null, defect.id)} whyNot={section.refusal} />
        </>
      )}
      <BackLink href={defect ? `/team/defects/${defect.id}` : "/team/defects"}>
        {defect ? teamMessages.defects.backToDefect : teamMessages.defects.back}
      </BackLink>
    </Page>
  );
}

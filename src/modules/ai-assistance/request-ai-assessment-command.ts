import { aggregateCommand, type Database } from "@/platform/command";
import { defectForAiAssessmentRequest } from "@/modules/repair";
import { requestAiAssessment, type RequestAiAssessmentFacts } from "./ai-assessment";
import { aiAssessmentBeingWritten, aiAssessments } from "./ai-assessments";
import { aiState, type AiDependencies } from "./ai-settings";
import { aiAssistanceEvents } from "./events";

/** What the request's rule reads – in the command's facts, and for the page that asks the same rule (G11). */
export async function requestAiAssessmentFacts(
  db: Database,
  defectId: string,
  dependencies: Pick<AiDependencies, "encryptionKey">,
): Promise<RequestAiAssessmentFacts> {
  const [aiNow, defect, beingWritten] = await Promise.all([
    aiState(db, dependencies),
    defectForAiAssessmentRequest(db, defectId),
    aiAssessmentBeingWritten(db, defectId),
  ]);
  return { chatModel: aiNow.on ? aiNow.chatModel : undefined, defect, beingWritten };
}

/**
 * CMD-RequestAiAssessment through the command layer (ST-107): a creating command on AGG-AiAssessment. Its facts read
 * the AI settings of AI assistance and the defect's state from Repair's public query – without a lock (context map);
 * a defect resolved right afterwards does not stop the AI assessment (HS-30). The store's partial unique index backs
 * the set-based rule HS-31 – at most one AI assessment of a defect is being written.
 */
export function requestAiAssessmentCommand(dependencies: AiDependencies) {
  return aggregateCommand({
    id: "CMD-RequestAiAssessment",
    allowedActors: ["helper", "technician"],
    store: aiAssessments,
    creates: true,
    facts: (tx, input) => requestAiAssessmentFacts(tx, input.defectId, dependencies),
    decide: requestAiAssessment,
    journal: aiAssistanceEvents.journal,
    result: ({ id }) => ({ aiAssessmentId: id }),
  });
}

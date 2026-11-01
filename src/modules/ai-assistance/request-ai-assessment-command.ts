import { aggregateCommand } from "@/platform/command";
import { defectForAiAssessmentRequest } from "@/modules/repair";
import { requestAiAssessment, type RequestAiAssessmentFacts } from "./ai-assessment";
import { aiAssessmentBeingWritten, aiAssessments } from "./ai-assessments";
import { aiAssessmentSettings, type AiDependencies } from "./ai-settings";
import { aiAssistanceEvents } from "./events";

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
    facts: async (tx, input): Promise<RequestAiAssessmentFacts> => {
      const [settings, defect, beingWritten] = await Promise.all([
        aiAssessmentSettings(tx, dependencies),
        defectForAiAssessmentRequest(tx, input.defectId),
        aiAssessmentBeingWritten(tx, input.defectId),
      ]);
      return { aiOn: settings.aiOn, chatModel: settings.chatModel, defect, beingWritten };
    },
    decide: requestAiAssessment,
    journal: aiAssistanceEvents.journal,
    result: ({ id }) => ({ aiAssessmentId: id }),
  });
}

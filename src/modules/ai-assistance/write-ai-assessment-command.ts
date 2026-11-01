import { aggregateCommand } from "@/platform/command";
import {
  failAiAssessment,
  writeAiAssessment,
  type AssessmentFailureReason,
  type WriteAiAssessmentInput,
} from "./ai-assessment";
import { aiAssessments } from "./ai-assessments";
import { aiAssistanceEvents } from "./events";

/**
 * CMD-WriteAiAssessment through the command layer (ST-107): run by POL-RequestedAiAssessmentIsWritten as the system, in
 * the short transaction that ends the background work's hold (ADR 0015). The row is loaded with a lock – a run of a
 * person saw no version – and only an AI assessment still requested is written: a late result after it was failed as
 * broken off records nothing (rule, HS-33).
 */
export type WriteAiAssessmentCommandInput = WriteAiAssessmentInput & { aiAssessmentId: string };

export const writeAiAssessmentCommand = aggregateCommand({
  id: "CMD-WriteAiAssessment",
  allowedActors: ["system"],
  store: aiAssessments,
  target: (input: WriteAiAssessmentCommandInput) => ({ id: input.aiAssessmentId }),
  decide: (state, input, context) => writeAiAssessment(state, input, context),
  journal: aiAssistanceEvents.journal,
  result: () => ({}),
});

/** The same command's failure half: EVT-AiAssessmentFailed with one of the domain's reasons (ST-108, ST-107 internal). */
export type FailAiAssessmentCommandInput = { aiAssessmentId: string; reason: AssessmentFailureReason };

export const failAiAssessmentCommand = aggregateCommand({
  id: "CMD-WriteAiAssessment",
  allowedActors: ["system"],
  store: aiAssessments,
  target: (input: FailAiAssessmentCommandInput) => ({ id: input.aiAssessmentId }),
  decide: (state, input, context) => failAiAssessment(state, input.reason, context),
  journal: aiAssistanceEvents.journal,
  result: () => ({}),
});

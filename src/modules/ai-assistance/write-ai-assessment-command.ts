import { aggregateCommand } from "@/platform/command";
import { filesOfMachineAndModelForAi, machineModelOfMachineForAi } from "@/modules/collection";
import { defectMachineForAiAssessment } from "@/modules/repair";
import {
  failAiAssessment,
  writeAiAssessment,
  type AiAssessmentState,
  type AiAssessmentWritten,
  type AssessmentFailureReason,
  type WriteAiAssessmentFacts,
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

export const writeAiAssessmentCommand = aggregateCommand<
  WriteAiAssessmentCommandInput,
  AiAssessmentState,
  AiAssessmentWritten,
  Record<string, never>,
  "not-requested",
  never,
  never,
  "system",
  WriteAiAssessmentFacts
>({
  id: "CMD-WriteAiAssessment",
  allowedActors: ["system"],
  store: aiAssessments,
  target: (input: WriteAiAssessmentCommandInput) => ({ id: input.aiAssessmentId }),
  decide: (state, input, context, facts) => writeAiAssessment(state, input, context, facts),
  // The invariant "every reference names a file of the defect's machine or its machine model" belongs to the aggregate,
  // not to the background run: the facts read the defect's machine and the files of that machine and its model.
  facts: async (tx, _input, state) => {
    const defect = await defectMachineForAiAssessment(tx, state.defectId);
    if (!defect) return { files: [] };
    const model = await machineModelOfMachineForAi(tx, defect.machineId);
    if (!model) return { files: [] };
    const files = await filesOfMachineAndModelForAi(tx, { machineId: defect.machineId, machineModelId: model.id });
    return { files: files.map((file) => file.id) };
  },
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

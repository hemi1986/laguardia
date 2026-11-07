import { filesOfMachineAndModelForAi, machineModelOfMachineForAi } from "@/modules/collection";
import { defectMachineForAiAssessment } from "@/modules/repair";
import { executeCommand } from "@/platform/command";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { failAiAssessmentCommand, writeAiAssessmentCommand } from "./write-ai-assessment-command";
import type { AiAssessmentReference, AssessmentFailureReason } from "./ai-assessment";
import { aiAssessmentById } from "./ai-assessments";

/**
 * An AI assessment the chat model already wrote (ST-107), for tests of what a page shows and of the scenarios that
 * start from a written one: CMD-WriteAiAssessment as the background work would run it. A test requests the assessment
 * first (CMD-RequestAiAssessment) – the aggregate's rule keeps a request before a write. The files references are
 * checked against are those attached to the defect's machine or its machine model now, as a run reads them (ST-120).
 */
export async function writeAiAssessmentForTest(
  db: Database,
  aiAssessmentId: string,
  {
    summary,
    probableCauses = [],
    whatToCheckFirst = [],
    references = [],
    filesSearched = [],
    embeddingModel,
    cost = 0.04,
    at,
  }: {
    summary: string;
    probableCauses?: string[];
    whatToCheckFirst?: string[];
    references?: AiAssessmentReference[];
    filesSearched?: string[];
    embeddingModel: string;
    cost?: number;
    at: Clock;
  },
): Promise<void> {
  const written = await executeCommand(
    writeAiAssessmentCommand,
    {
      aiAssessmentId,
      summary,
      probableCauses,
      whatToCheckFirst,
      references,
      filesAttached: await filesOfTheDefect(db, aiAssessmentId),
      filesSearched,
      embeddingModel,
      cost,
    },
    { actor: { kind: "system" }, db, clock: at },
  );
  if (!written.ok) throw new Error(written.error);
}

/** The files attached to the AI assessment's defect's machine or its machine model – what a run reads when it begins. */
async function filesOfTheDefect(db: Database, aiAssessmentId: string): Promise<string[]> {
  const assessment = await aiAssessmentById(db, aiAssessmentId);
  const defect = assessment && (await defectMachineForAiAssessment(db, assessment.defectId));
  const model = defect && (await machineModelOfMachineForAi(db, defect.machineId));
  if (!defect || !model) return [];
  const files = await filesOfMachineAndModelForAi(db, defect.machineId);
  return files.map((file) => file.id);
}

/**
 * An AI assessment that failed with a reason (ST-108), for tests of what a page shows: CMD-WriteAiAssessment's failure
 * half as the background work would run it.
 */
export async function failAiAssessmentForTest(
  db: Database,
  aiAssessmentId: string,
  { reason, at }: { reason: AssessmentFailureReason; at: Clock },
): Promise<void> {
  const failed = await executeCommand(
    failAiAssessmentCommand,
    { aiAssessmentId, reason },
    { actor: { kind: "system" }, db, clock: at },
  );
  if (!failed.ok) throw new Error(failed.error);
}

import { executeCommand } from "@/platform/command";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { writeAiAssessmentCommand } from "./write-ai-assessment-command";
import type { AiAssessmentReference } from "./ai-assessment";

/**
 * An AI assessment the chat model already wrote (ST-107), for tests of what a page shows and of the scenarios that
 * start from a written one: CMD-WriteAiAssessment as the background work would run it. A test requests the assessment
 * first (CMD-RequestAiAssessment) – the aggregate's rule keeps a request before a write.
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
      filesSearched,
      embeddingModel,
      cost,
    },
    { actor: { kind: "system" }, db, clock: at },
  );
  if (!written.ok) throw new Error(written.error);
}

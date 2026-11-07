import "server-only";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { s3Storage } from "@/platform/storage";
import { ownHostsOf, webFetcher } from "@/platform/web-fetch";
import { aiDependencies } from "./ai-settings";
import { aiAssessmentWork } from "./ai-assessment-work";
import { aiModelProposalWork } from "./ai-model-proposal-work";
import { proposedDocumentWork } from "./proposed-document-work";
import { fileIndexingWork } from "./file-indexing-work";
import type { AiWorkDependencies, AiWorkKind } from "./ai-work";

/**
 * The kinds of AI work, in the order a run takes them (ADR 0015): AI assessments and AI model proposals still
 * requested before waiting files, because a person is waiting. ST-107 writes an AI assessment first, ST-124 an AI model
 * proposal, ST-129 loads the links of a saved one, ST-106 indexes a file after them.
 */
export const aiWorkKinds: readonly AiWorkKind[] = [
  aiAssessmentWork,
  aiModelProposalWork,
  // The links of a saved proposal (ST-129) before the files they become are indexed, in the same run (ADR 0019).
  proposedDocumentWork(webFetcher({ ownHosts: ownHostsOf(process.env) })),
  fileIndexingWork,
];

/** The budget a run gets when `AI_WORK_BUDGET_SECONDS` is not set – fits the 300 s of Vercel Hobby (ST-105). */
export const DEFAULT_AI_WORK_BUDGET_SECONDS = 250;

/** `AI_WORK_BUDGET_SECONDS`: a whole number of seconds above zero, else the default. */
export function aiWorkBudgetSeconds(setting: string | undefined): number {
  const seconds = Number(setting);
  return setting && Number.isSafeInteger(seconds) && seconds > 0 ? seconds : DEFAULT_AI_WORK_BUDGET_SECONDS;
}

/** The real dependencies of a run: the database, the system clock, OpenRouter, S3 and the budget setting. */
export function aiWorkDependencies({ continueWork }: { continueWork: () => Promise<void> }): AiWorkDependencies {
  return {
    db: database(),
    clock: systemClock,
    ai: aiDependencies(),
    storage: s3Storage(),
    budgetSeconds: aiWorkBudgetSeconds(process.env.AI_WORK_BUDGET_SECONDS),
    continueWork,
    kinds: aiWorkKinds,
  };
}

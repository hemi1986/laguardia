import "server-only";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { s3Storage } from "@/platform/storage";
import { aiDependencies } from "./ai-settings";
import type { AiWorkDependencies, AiWorkKind } from "./ai-work";

/**
 * The kinds of AI work, in the order a run takes them (ADR 0015): AI assessments still requested before waiting files,
 * because a person is waiting. ST-107 adds writing an AI assessment first, ST-106 indexing a file after it.
 */
export const aiWorkKinds: readonly AiWorkKind[] = [];

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

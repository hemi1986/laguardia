import { after } from "next/server";
import { aiWorkDependencies, runAiWork } from "@/modules/ai-assistance";
import { startAiWork } from "./start-ai-work";
import { workerRoute } from "./worker-route";

/**
 * The worker route of the AI work (ST-112, ADR 0015). `maxDuration` must be a literal here (static route config): 300 s,
 * the longest Vercel Hobby allows – a longer value fails the deployment. A run's budget is the setting
 * `AI_WORK_BUDGET_SECONDS` (docs/operations/ai-work.md).
 */
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  return workerRoute({
    secret: () => process.env.AI_WORK_SECRET,
    run: () => runAiWork(aiWorkDependencies({ continueWork: () => startAiWork({ env: process.env, fetch }) })),
    afterResponse: (work) => after(work),
  })(request);
}

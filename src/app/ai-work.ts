import "server-only";
import { after } from "next/server";
import { makesAiWork } from "@/modules/ai-assistance";
import type { CommittedEvent } from "@/platform/command";
import { startAiWork } from "./api/ai-work/start-ai-work";

/** Starts one run of the AI work after the response (ST-112, ADR 0015) – the page does not wait for it. */
export function startAiWorkAfterResponse(): void {
  after(() => startAiWork({ env: process.env, fetch }));
}

/** What every form's command does once it has committed (`formAction`): starts the work, when it made any. */
export function startAiWorkForCommitted(events: readonly CommittedEvent[]): void {
  if (makesAiWork(events)) startAiWorkAfterResponse();
}

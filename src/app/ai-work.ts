import "server-only";
import { after } from "next/server";
import { aiWorkLeftUnfinished } from "@/modules/ai-assistance";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { startAiWork } from "./api/ai-work/start-ai-work";

/**
 * Starts the AI work after the response (ST-112, ADR 0015) – for a Server Action whose command made work (saving the
 * AI settings, a request, attaching a file, „Erneut versuchen“), called once the command has committed. The page does
 * not wait for it.
 */
export function startAiWorkAfterResponse(): void {
  after(() => startAiWork({ env: process.env, fetch }));
}

/**
 * For a page that shows AI work (the defect page, ST-108; the form „KI“, ST-109): starts a run after the response only
 * when work of this kind – or of these pieces – was left unfinished, so refreshing the page never starts work on
 * every load (HS-33, HS-35).
 */
export async function startAiWorkWhenLeftUnfinished(kind: string, pieceIds?: readonly string[]): Promise<void> {
  if (await aiWorkLeftUnfinished(database(), systemClock, kind, pieceIds)) startAiWorkAfterResponse();
}

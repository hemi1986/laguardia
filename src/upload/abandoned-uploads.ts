import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import { ABANDONED_AFTER_HOURS } from "./limits";
import type { UploadDependencies } from "./pending-uploads";
import { pendingUpload } from "./schema";

/**
 * Cleans up abandoned uploads (ST-085, ADR 0009): content uploaded from the browser whose form was never sent. Pending
 * uploads older than the fixed age are deleted, the oldest first and at most `atMost` per call, each with its content
 * in one transaction – a failed content deletion keeps the record for the next call. Run after the response of a
 * later request (Next.js `after()`), never by a scheduler (ADR 0002). Never throws: the request it follows is done.
 */
export async function cleanUpAbandonedUploads(
  { db, storage, clock }: UploadDependencies,
  { atMost = 20 }: { atMost?: number } = {},
): Promise<void> {
  const abandonedBefore = new Date(clock.now().getTime() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000);
  const abandoned = await db
    .select({ name: pendingUpload.name })
    .from(pendingUpload)
    .where(lte(pendingUpload.issuedAt, abandonedBefore))
    .orderBy(asc(pendingUpload.issuedAt))
    .limit(atMost);
  for (const { name } of abandoned) {
    try {
      await db.transaction(async (tx) => {
        // The same row-level delete as attaching takes the record with – only one of the two gets it (ADR 0009).
        const taken = await tx
          .delete(pendingUpload)
          .where(and(eq(pendingUpload.name, name), lte(pendingUpload.issuedAt, abandonedBefore)))
          .returning({ name: pendingUpload.name });
        if (taken.length > 0) await storage.delete(name);
      });
    } catch (error) {
      // The record stays; the next request tries again. Logged by the content's name only.
      console.error(`abandoned upload not cleaned up: ${name}:`, error instanceof Error ? error.message : error);
    }
  }
}

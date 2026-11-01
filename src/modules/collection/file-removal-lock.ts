import { sql } from "drizzle-orm";
import type { Database } from "@/platform/command";

/**
 * A file's removal lock (ADR 0014, ST-106): a transaction-scoped advisory lock per file. Collection's CMD-RemoveFile
 * takes it exclusively before it decides; an indexing that stores its result takes it shared in the transaction that
 * stores the AI index entry. So an indexing storing during a removal waits and then records nothing, and a removal
 * starting during a store waits and its policy removes the entry the store just wrote. Like the retirement lock
 * (ADR 0010), it comes before any row lock of the command's own.
 */
export async function fileRemovalLock(tx: Database, fileId: string, mode: "exclusive" | "shared"): Promise<void> {
  const key = sql`hashtext(${"file:" + fileId})`;
  await tx.execute(
    mode === "exclusive" ? sql`SELECT pg_advisory_xact_lock(${key})` : sql`SELECT pg_advisory_xact_lock_shared(${key})`,
  );
}

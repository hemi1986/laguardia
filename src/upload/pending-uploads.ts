import "server-only";
import { and, eq, gt } from "drizzle-orm";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { ContentStorage, UploadAddress } from "@/platform/storage";
import { contentName, FILE_SIZE_LIMIT } from "./limits";
import { pendingUpload } from "./schema";

/** Who uploaded content belongs to – a machine or a machine model (`AGG-File`: exactly one of them). */
export type UploadOwner = { machineId: string } | { machineModelId: string };

export type UploadDependencies = { db: Database; storage: ContentStorage; clock: Clock; newId: () => string };

/** How long an upload address is valid – long enough for 100 MB over a slow phone connection (ADR 0009). */
const UPLOAD_ADDRESS_MINUTES = 30;

/**
 * Names content a team member is about to upload and records it as a pending upload of its owner (ADR 0009) – the
 * first of the two steps of a direct upload. Call it only after the request's own access check (team members only).
 * A request may ask for a stricter size limit than the file size limit, never for a larger one.
 */
export async function recordPendingUpload(
  { db, clock, newId }: UploadDependencies,
  request: { issuedTo: string; owner: UploadOwner; maximumSize?: number },
): Promise<{ ok: true; name: string } | { ok: false; error: "unknown-owner" }> {
  const name = contentName(newId());
  try {
    await db.insert(pendingUpload).values({
      name,
      machineId: "machineId" in request.owner ? request.owner.machineId : null,
      machineModelId: "machineModelId" in request.owner ? request.owner.machineModelId : null,
      issuedTo: request.issuedTo,
      issuedAt: clock.now(),
      maximumSize: Math.min(request.maximumSize ?? FILE_SIZE_LIMIT, FILE_SIZE_LIMIT),
    });
  } catch (error) {
    if (isForeignKeyViolation(error, ["machine_id", "machine_model_id"])) return { ok: false, error: "unknown-owner" };
    throw error;
  }
  return { ok: true, name };
}

/**
 * The second step: the permission to upload a pending upload's content – only for the team member it was recorded
 * for, for exactly its name and size limit, until 30 minutes after it was recorded. Nothing for anything else.
 */
export async function uploadAddressOf(
  { db, storage, clock }: UploadDependencies,
  request: { issuedTo: string; name: string },
): Promise<UploadAddress | undefined> {
  const earliest = new Date(clock.now().getTime() - UPLOAD_ADDRESS_MINUTES * 60 * 1000);
  const [pending] = await db
    .select({ issuedAt: pendingUpload.issuedAt, maximumSize: pendingUpload.maximumSize })
    .from(pendingUpload)
    .where(
      and(
        eq(pendingUpload.name, request.name),
        eq(pendingUpload.issuedTo, request.issuedTo),
        gt(pendingUpload.issuedAt, earliest),
      ),
    );
  if (!pending) return undefined;
  const validUntil = new Date(pending.issuedAt.getTime() + UPLOAD_ADDRESS_MINUTES * 60 * 1000);
  return storage.uploadAddress(request.name, { maximumSize: pending.maximumSize, validUntil });
}

function isForeignKeyViolation(error: unknown, columns: string[]): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  const { code, constraint } = (cause ?? {}) as { code?: string; constraint?: string };
  return code === "23503" && columns.some((column) => constraint?.includes(column));
}

import "server-only";
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

/** What a team member's browser asks for: to upload a file of this exact size and media type for an owner. */
export type UploadRequest = {
  issuedTo: string;
  owner: UploadOwner;
  size: number;
  contentType: string;
  /** A stricter size limit than the file size limit (the browser tests ask for one) – never a larger one. */
  maximumSize?: number;
};

/**
 * Gives a team member's browser the permission to upload one file (ST-085, ST-099, ADR 0009/0012). Call it only after
 * the request's own access check (team members only). A declared size above the limit gets nothing – no name, no
 * record, no signature (`too-large`). Otherwise the server names the content, records it as a pending upload of its
 * owner, and only then signs an upload address for exactly that name, size and media type, valid for 30 minutes.
 */
export async function grantUploadAddress(
  { db, storage, clock, newId }: UploadDependencies,
  request: UploadRequest,
): Promise<{ ok: true; name: string; address: UploadAddress } | { ok: false; error: "too-large" | "unknown-owner" }> {
  const maximumSize = Math.min(request.maximumSize ?? FILE_SIZE_LIMIT, FILE_SIZE_LIMIT);
  if (request.size > maximumSize) return { ok: false, error: "too-large" };
  const name = contentName(newId());
  const issuedAt = clock.now();
  try {
    await db.insert(pendingUpload).values({
      name,
      machineId: "machineId" in request.owner ? request.owner.machineId : null,
      machineModelId: "machineModelId" in request.owner ? request.owner.machineModelId : null,
      issuedTo: request.issuedTo,
      issuedAt,
      maximumSize,
      declaredSize: request.size,
    });
  } catch (error) {
    if (isForeignKeyViolation(error, ["machine_id", "machine_model_id"])) return { ok: false, error: "unknown-owner" };
    throw error;
  }
  const validUntil = new Date(issuedAt.getTime() + UPLOAD_ADDRESS_MINUTES * 60 * 1000);
  const address = await storage.uploadAddress(name, {
    size: request.size,
    contentType: request.contentType,
    validUntil,
  });
  return { ok: true, name, address };
}

function isForeignKeyViolation(error: unknown, columns: string[]): boolean {
  const cause = error instanceof Error && "cause" in error ? error.cause : error;
  const { code, constraint } = (cause ?? {}) as { code?: string; constraint?: string };
  return code === "23503" && columns.some((column) => constraint?.includes(column));
}

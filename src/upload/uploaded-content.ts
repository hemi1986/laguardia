import "server-only";
import { and, eq, gt } from "drizzle-orm";
import type { CommandResult } from "@/platform/command";
import type { ContentStorage } from "@/platform/storage";
import { abandonedUntil } from "./limits";
import type { UploadDependencies, UploadOwner } from "./pending-uploads";
import { pendingUpload } from "./schema";

/** Why uploaded content cannot be attached – each needs a text in the attaching form (ST-037). */
export const uploadedContentErrors = ["content-gone", "too-large"] as const;
export type UploadedContentError = (typeof uploadedContentErrors)[number];

/**
 * The one way to attach content uploaded from the browser (ST-085, ADR 0009, for CMD-AttachFile in ST-037): take the
 * pending upload – it must name this content, belong to this owner and be younger than the fixed age –, then run the
 * command with the content's name, and delete the content if the command is rejected or throws (ADR 0007).
 * Content larger than its pending upload allowed is deleted and refused as `too-large`; the command does not run.
 * Without such a pending upload the command does not run: the content is gone (cleaned up as abandoned) or was never
 * this owner's – `content-gone`, so the form says that the file must be chosen again.
 */
export async function withUploadedContent<Result, Error extends string>(
  { db, storage, clock }: UploadDependencies,
  uploaded: { name: string; owner: UploadOwner },
  run: (content: string) => Promise<CommandResult<Result, Error>>,
): Promise<CommandResult<Result, Error> | { ok: false; error: UploadedContentError }> {
  const youngest = abandonedUntil(clock.now());
  // Taking the record is a row-level delete: the cleanup of abandoned uploads deletes it the same way, so the content
  // is either attached or cleaned up, never both (ADR 0009).
  const taken = await db
    .delete(pendingUpload)
    .where(
      and(
        eq(pendingUpload.name, uploaded.name),
        "machineId" in uploaded.owner
          ? eq(pendingUpload.machineId, uploaded.owner.machineId)
          : eq(pendingUpload.machineModelId, uploaded.owner.machineModelId),
        gt(pendingUpload.issuedAt, youngest),
      ),
    )
    .returning({ maximumSize: pendingUpload.maximumSize });
  if (taken.length === 0) return { ok: false, error: "content-gone" };

  // From here on the record is gone, so nothing but this function deletes the content: every way out that does not
  // attach it deletes it (ADR 0009).
  let outcome: CommandResult<Result, Error> | { ok: false; error: UploadedContentError };
  try {
    // Blob holds an upload in one piece to the upload address's size limit, but not an upload in parts (above 20 MB,
    // found in ST-085) – so the size is checked here too, before the command runs.
    const size = await storage.size(uploaded.name);
    if (size === undefined) return { ok: false, error: "content-gone" };
    outcome = size > taken[0].maximumSize ? { ok: false, error: "too-large" } : await run(uploaded.name);
  } catch (error) {
    await deleteQuietly(storage, uploaded.name);
    throw error;
  }
  if (!outcome.ok) await deleteQuietly(storage, uploaded.name);
  return outcome;
}

/**
 * Deletes the content of a failed command. If that fails too, the person still gets the command's answer: the content
 * stays behind unreferenced in the private store – the crash leftover of ADR 0009.
 */
async function deleteQuietly(storage: ContentStorage, name: string): Promise<void> {
  try {
    await storage.delete(name);
  } catch {
    // unreferenced and unreachable without a signed address – accepted (ADR 0009)
  }
}

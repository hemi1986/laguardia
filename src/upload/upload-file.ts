import { uploadPresigned } from "@vercel/blob/client";
import { FILE_SIZE_LIMIT } from "./limits";
import type { UploadOwner } from "./pending-uploads";

/** The route that issues upload addresses (`src/app/api/uploads/route.ts`). */
const UPLOAD_ADDRESS_ROUTE = "/api/uploads";

/** Above this size the upload goes in parts – parallel, each retried on its own (ADR 0006: multipart above 20 MB). */
const MULTIPART_ABOVE = 20 * 1024 * 1024;

/** Why an upload did not happen – a form names the reason instead of attaching nothing. */
export type UploadError = "too-large" | "not-uploaded";

/**
 * Uploads a chosen file from the browser straight to the private store (ST-085, ADR 0009) – the counterpart of the
 * photo module's `preparePhoto`. Asks the server to name the content for its owner, then uploads it with the upload
 * address the server signed for that name; the file never passes through a function. Reports progress in percent
 * while it runs and resolves with the content's name – what the attaching form sends – or the reason it failed.
 * `maximumSize` asks for a stricter limit than the file size limit, never a larger one.
 */
export async function uploadFile(
  file: File,
  {
    owner,
    maximumSize,
    onProgress,
  }: { owner: UploadOwner; maximumSize?: number; onProgress?: (percent: number) => void },
): Promise<{ ok: true; name: string; storeAddress: string } | { ok: false; error: UploadError }> {
  if (file.size > FILE_SIZE_LIMIT) return { ok: false, error: "too-large" };
  try {
    const started = await fetch(UPLOAD_ADDRESS_ROUTE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "laguardia.pending-upload", owner, maximumSize }),
    });
    if (!started.ok) return { ok: false, error: "not-uploaded" };
    const { name } = (await started.json()) as { name: string };
    const uploaded = await uploadPresigned(name, file, {
      access: "private",
      handleUploadUrl: UPLOAD_ADDRESS_ROUTE,
      multipart: file.size > MULTIPART_ABOVE,
      contentType: file.type || "application/octet-stream",
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage)),
    });
    return { ok: true, name, storeAddress: uploaded.url };
  } catch (error) {
    return { ok: false, error: refusedAsTooLarge(error) ? "too-large" : "not-uploaded" };
  }
}

/**
 * Blob refuses content above the upload address's limit with its `BlobFileTooLargeError` – only its message tells it
 * apart in the browser: the class lives in the server half of `@vercel/blob`, which the browser bundle must not load.
 */
function refusedAsTooLarge(error: unknown): boolean {
  return error instanceof Error && error.message.includes("File is too large");
}

import type { UploadAddress } from "@/platform/storage";
import { FILE_SIZE_LIMIT } from "./limits";
import type { UploadOwner } from "./pending-uploads";

/** The route that issues upload addresses (`src/app/api/uploads/route.ts`). */
const UPLOAD_ADDRESS_ROUTE = "/api/uploads";

/** Why an upload did not happen – a form names the reason instead of attaching nothing. */
export type UploadError = "too-large" | "not-uploaded";

/**
 * Uploads a chosen file from the browser straight to the private bucket (ST-085, ST-099, ADR 0009/0012) – the
 * counterpart of the photo module's `preparePhoto`. Declares the file's size and media type to the server, which names
 * the content for its owner and signs one PUT for exactly that; the file never passes through a function. Reports
 * progress in percent while it runs and resolves with the content's name – what the attaching form sends – or the
 * reason it failed. `too-large` comes only from the file size limit here or from the server refusing the declared size:
 * a store's refusal of the PUT looks the same in a browser whatever its reason, so it is `not-uploaded`.
 * `maximumSize` asks for a stricter limit than the file size limit, never a larger one.
 */
export async function uploadFile(
  file: File,
  {
    owner,
    maximumSize,
    onProgress,
  }: { owner: UploadOwner; maximumSize?: number; onProgress?: (percent: number) => void },
): Promise<{ ok: true; name: string } | { ok: false; error: UploadError }> {
  if (file.size > FILE_SIZE_LIMIT) return { ok: false, error: "too-large" };
  try {
    const issued = await fetch(UPLOAD_ADDRESS_ROUTE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "laguardia.upload-address",
        owner,
        size: file.size,
        contentType: file.type || "application/octet-stream",
        maximumSize,
      }),
    });
    if (issued.status === 413) return { ok: false, error: "too-large" };
    if (!issued.ok) return { ok: false, error: "not-uploaded" };
    const { name, address } = (await issued.json()) as { name: string; address: UploadAddress };
    const stored = await put(file, address, onProgress);
    return stored ? { ok: true, name } : { ok: false, error: "not-uploaded" };
  } catch {
    return { ok: false, error: "not-uploaded" };
  }
}

/**
 * One PUT of the whole file with the address's headers – through `XMLHttpRequest`, because `fetch` reports no upload
 * progress. The browser sets `Content-Length` from the file, which the signature binds. Whether the store took it.
 */
function put(file: File, address: UploadAddress, onProgress?: (percent: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", address.url);
    for (const [header, value] of Object.entries(address.headers)) request.setRequestHeader(header, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => resolve(request.status >= 200 && request.status < 300);
    request.onerror = () => resolve(false);
    request.onabort = () => resolve(false);
    request.send(file);
  });
}

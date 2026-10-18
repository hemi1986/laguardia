import "server-only";
import { isId } from "@/platform/command";
import { isSameOrigin } from "@/platform/same-origin";
import {
  cleanUpAbandonedUploads,
  recordPendingUpload,
  uploadAddressOf,
  type UploadDependencies,
  type UploadOwner,
} from "@/upload";

export type UploadRouteDependencies = UploadDependencies & {
  /** The team member of the request's session – none without a session, or for a deactivated account. */
  teamMember: (headers: Headers) => Promise<{ id: string } | undefined>;
  /** Runs work after the response is sent (Next.js `after()`), so the person asking does not wait for it. */
  afterResponse: (work: () => Promise<void>) => void;
};

/**
 * The route that issues upload addresses (ST-085, ADR 0009) – the two steps of a direct upload from the browser:
 * 1. `laguardia.pending-upload` with the owner (and, if wanted, a stricter size limit): the server names the content and
 *    records it as a pending upload → `{ name }`; afterwards abandoned uploads are cleaned up.
 * 2. `blob.generate-presigned-url` – sent by the Blob client library's `uploadPresigned` with that name: the upload
 *    address for it → `{ presignedUrlPayload }`.
 * The page proxy does not cover `/api/`, so the route checks the Origin and the team session itself, before anything.
 */
export function uploadRoute(dependencies: UploadRouteDependencies) {
  return async function POST(request: Request): Promise<Response> {
    if (!isSameOrigin(request.headers)) return new Response("Forbidden", { status: 403 });
    const teamMember = await dependencies.teamMember(request.headers);
    if (!teamMember) return new Response("Unauthorized", { status: 401 });

    const body: unknown = await request.json().catch(() => undefined);
    const start = pendingUploadRequest(body);
    if (start) {
      const pending = await recordPendingUpload(dependencies, { issuedTo: teamMember.id, ...start });
      if (!pending.ok) return new Response("Unknown owner", { status: 400 });
      dependencies.afterResponse(() => cleanUpAbandonedUploads(dependencies));
      return Response.json({ name: pending.name });
    }
    const name = uploadAddressRequest(body);
    if (name) {
      const address = await uploadAddressOf(dependencies, { issuedTo: teamMember.id, name });
      if (!address) return new Response("Forbidden", { status: 403 });
      return Response.json({ type: "blob.generate-presigned-url", presignedUrlPayload: address });
    }
    return new Response("Bad request", { status: 400 });
  };
}

function pendingUploadRequest(body: unknown): { owner: UploadOwner; maximumSize?: number } | undefined {
  if (!isObject(body) || body.type !== "laguardia.pending-upload" || !isObject(body.owner)) return undefined;
  const { owner, maximumSize } = body;
  const size = Number.isSafeInteger(maximumSize) && (maximumSize as number) > 0 ? (maximumSize as number) : undefined;
  if (isIdString(owner.machineId)) return { owner: { machineId: owner.machineId }, maximumSize: size };
  if (isIdString(owner.machineModelId)) return { owner: { machineModelId: owner.machineModelId }, maximumSize: size };
  return undefined;
}

function uploadAddressRequest(body: unknown): string | undefined {
  if (!isObject(body) || body.type !== "blob.generate-presigned-url" || !isObject(body.payload)) return undefined;
  return typeof body.payload.pathname === "string" ? body.payload.pathname : undefined;
}

function isIdString(value: unknown): value is string {
  return typeof value === "string" && isId(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

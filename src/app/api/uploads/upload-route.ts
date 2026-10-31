import "server-only";
import { isId } from "@/platform/command";
import { isSameOrigin } from "@/platform/same-origin";
import { cleanUpAbandonedUploads, issueUploadAddress, type UploadDependencies, type UploadRequest } from "@/upload";

export type UploadRouteDependencies = UploadDependencies & {
  /** The team member of the request's session – none without a session, or for a deactivated account. */
  teamMember: (headers: Headers) => Promise<{ id: string } | undefined>;
  /** Runs work after the response is sent (Next.js `after()`), so the person asking does not wait for it. */
  afterResponse: (work: () => Promise<void>) => void;
};

/**
 * The route that issues upload addresses (ST-085, ST-099, ADR 0009/0012). The browser asks with
 * `laguardia.upload-address`: the owner, the exact size and the media type of the file it will upload (and, if wanted,
 * a stricter size limit). A size above the limit is refused with 413 before anything is recorded or signed; otherwise
 * the server names the content, records it as a pending upload and answers `{ name, address }` – the presigned PUT
 * for exactly that name, size and media type. Afterwards abandoned uploads are cleaned up.
 * The page proxy does not cover `/api/`, so the route checks the Origin and the team session itself, before anything.
 */
export function uploadRoute(dependencies: UploadRouteDependencies) {
  return async function POST(request: Request): Promise<Response> {
    if (!isSameOrigin(request.headers)) return new Response("Forbidden", { status: 403 });
    const teamMember = await dependencies.teamMember(request.headers);
    if (!teamMember) return new Response("Unauthorized", { status: 401 });

    const asked = uploadRequest(await request.json().catch(() => undefined));
    if (!asked) return new Response("Bad request", { status: 400 });
    const issued = await issueUploadAddress(dependencies, { issuedTo: teamMember.id, ...asked });
    if (!issued.ok) {
      return issued.error === "too-large"
        ? new Response("Content too large", { status: 413 })
        : new Response("Unknown owner", { status: 400 });
    }
    dependencies.afterResponse(() => cleanUpAbandonedUploads(dependencies));
    return Response.json({ name: issued.name, address: issued.address });
  };
}

function uploadRequest(body: unknown): Omit<UploadRequest, "issuedTo"> | undefined {
  if (!isObject(body) || body.type !== "laguardia.upload-address" || !isObject(body.owner)) return undefined;
  const { owner, size, contentType, maximumSize } = body;
  if (!Number.isSafeInteger(size) || (size as number) < 0 || !isMediaType(contentType)) return undefined;
  const declared = {
    size: size as number,
    contentType,
    maximumSize: Number.isSafeInteger(maximumSize) && (maximumSize as number) > 0 ? (maximumSize as number) : undefined,
  };
  if (isIdString(owner.machineId)) return { owner: { machineId: owner.machineId }, ...declared };
  if (isIdString(owner.machineModelId)) return { owner: { machineModelId: owner.machineModelId }, ...declared };
  return undefined;
}

/** A media type as a browser names a file's – `type/subtype`, nothing that could carry another header. */
function isMediaType(value: unknown): value is string {
  return typeof value === "string" && value.length <= 127 && /^[\w.+-]+\/[\w.+-]+$/.test(value);
}

function isIdString(value: unknown): value is string {
  return typeof value === "string" && isId(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

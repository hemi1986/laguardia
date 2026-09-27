import "server-only";
import { issueSignedToken, list, presignUrl } from "@vercel/blob";

export type SpikeFile = { pathname: string; size: number; downloadUrl: string };

/** Lists the spike's private blobs, each with a presigned download URL valid for 5 minutes. */
export async function spikeFiles(): Promise<SpikeFile[]> {
  const { blobs } = await list({ prefix: "spike/" });
  if (!blobs.length) return [];
  const validUntil = Date.now() + 5 * 60 * 1000;
  const token = await issueSignedToken({ pathname: "*", operations: ["get"], validUntil });
  return Promise.all(
    blobs.map(async (b) => ({
      pathname: b.pathname,
      size: b.size,
      downloadUrl: (await presignUrl(token, { operation: "get", pathname: b.pathname, access: "private", validUntil }))
        .presignedUrl,
    })),
  );
}

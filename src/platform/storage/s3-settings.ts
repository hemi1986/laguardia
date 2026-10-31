/**
 * Where the S3 adapter of the storage seam stores content (ST-099, ADR 0012) – read only from the environment:
 * - `S3_BUCKET`, `S3_REGION` – always;
 * - `S3_ENDPOINT` – only for a store other than AWS (locally SeaweedFS, `http://localhost:8333`), addressed path-style;
 *   without it the regional AWS endpoint (`s3.<region>.amazonaws.com`), virtual-hosted – never the global one, which
 *   can redirect a new bucket's requests and so break the browser's CORS preflight;
 * - credentials: `AWS_ROLE_ARN` on Vercel (the role is assumed through Vercel's OIDC token – no long-lived key), or
 *   `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (locally the fixed development identity of `docker-compose.yml`).
 * No SDK here: the content security policy needs the store's origin on every page request.
 */
export type S3Settings = {
  bucket: string;
  region: string;
  endpoint: string | undefined;
  credentials: { roleArn: string } | { accessKeyId: string; secretAccessKey: string };
};

export function s3Settings(environment: Record<string, string | undefined> = process.env): S3Settings | undefined {
  const value = (name: string) => environment[name]?.trim() || undefined;
  const bucket = value("S3_BUCKET");
  const region = value("S3_REGION");
  if (!bucket || !region) return undefined;
  const roleArn = value("AWS_ROLE_ARN");
  const accessKeyId = value("S3_ACCESS_KEY_ID");
  const secretAccessKey = value("S3_SECRET_ACCESS_KEY");
  const credentials = roleArn
    ? { roleArn }
    : accessKeyId && secretAccessKey
      ? { accessKeyId, secretAccessKey }
      : undefined;
  if (!credentials) return undefined;
  return { bucket, region, endpoint: value("S3_ENDPOINT"), credentials };
}

/**
 * The origin every address of the bucket starts with – what the content security policy allows for photos, uploads and
 * downloads, exactly this one (ST-099). Path-style at an own endpoint (scheme and port included, e.g.
 * `http://localhost:8333`), virtual-hosted at AWS (`https://<bucket>.s3.<region>.amazonaws.com`) – the same addressing
 * the adapter signs with (`s3-storage.ts`), and a test holds both together.
 */
export function storeOrigin({ bucket, region, endpoint }: S3Settings): string {
  return endpoint ? new URL(endpoint).origin : `https://${bucket}.s3.${region}.amazonaws.com`;
}

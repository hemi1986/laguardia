import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { systemClock, type Clock } from "@/platform/clock";
import type { ContentStorage } from ".";
import { s3Settings, type S3Settings } from "./s3-settings";

/**
 * The S3 adapter of the storage seam (ST-099, ADR 0012) – AWS S3 in eu-central-1 on Vercel, SeaweedFS locally, one
 * adapter for both. The only file that may import the S3 SDK (lint). Content goes into the private bucket under the
 * caller's name and is read only through presigned addresses, signed here without a request to the store. Configured
 * only from the environment (`s3-settings.ts`); the clock gives the signing date, so tests can sign in the past.
 */
export function s3Storage({
  settings = s3Settings(),
  clock = systemClock,
}: { settings?: S3Settings; clock?: Clock } = {}): ContentStorage {
  let client: S3Client | undefined;
  const store = () => {
    if (!settings)
      throw new Error("No object store configured: set S3_BUCKET, S3_REGION and credentials (.env.example)");
    client ??= clientFor(settings);
    return { client, bucket: settings.bucket };
  };
  const secondsUntil = (validUntil: Date) =>
    Math.max(1, Math.floor((validUntil.getTime() - clock.now().getTime()) / 1000));

  return {
    async write(name, bytes, contentType) {
      const { client, bucket } = store();
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: name, Body: bytes, ContentType: contentType }));
    },
    async delete(name) {
      const { client, bucket } = store();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: name }));
    },
    async viewAddresses(names, validUntil, { download = false } = {}) {
      const { client, bucket } = store();
      const signed = await Promise.all(
        names.map(async (name) => {
          // The disposition is part of the signature: the store sends the content to be saved, never opened (ST-037).
          const command = new GetObjectCommand({
            Bucket: bucket,
            Key: name,
            ResponseContentDisposition: download ? "attachment" : undefined,
          });
          const address = await getSignedUrl(client, command, {
            expiresIn: secondsUntil(validUntil),
            signingDate: clock.now(),
          });
          return [name, address] as const;
        }),
      );
      return new Map(signed);
    },
    async uploadAddress(name, { size, contentType, validUntil }) {
      const { client, bucket } = store();
      // A plain presigned PUT has no size range: the signature binds the exact length the browser declared, the media
      // type, and that nothing is stored under the name yet – the store refuses any other request (ADR 0012).
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: name,
        ContentLength: size,
        ContentType: contentType,
        IfNoneMatch: "*",
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: secondsUntil(validUntil),
        signingDate: clock.now(),
        signableHeaders: new Set(["content-length", "content-type", "if-none-match"]),
      });
      return { url, headers: { "Content-Type": contentType, "If-None-Match": "*" } };
    },
    async details(name) {
      const { client, bucket } = store();
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: name }));
        return { size: head.ContentLength ?? 0, contentType: head.ContentType ?? "application/octet-stream" };
      } catch (error) {
        if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return undefined;
        throw error;
      }
    },
  };
}

function clientFor({ region, endpoint, credentials }: S3Settings): S3Client {
  return new S3Client({
    region,
    endpoint,
    // An own endpoint (SeaweedFS) is addressed path-style, AWS virtual-hosted – as `storeOrigin` derives the host.
    forcePathStyle: endpoint !== undefined,
    // No checksum the browser would have to compute and send with its PUT.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: "roleArn" in credentials ? roleCredentials(credentials.roleArn, region) : credentials,
  });
}

type TemporaryCredentials = Awaited<ReturnType<ReturnType<typeof awsCredentialsProvider>>>;

/** An upload address lives 30 minutes; credentials it is signed with must outlive it (ADR 0012), with a margin. */
export const CREDENTIALS_MUST_LAST_MS = 35 * 60 * 1000;

/** One provider per role for the whole function instance, so the role is not assumed again for every request. */
const assumedRoles = new Map<string, () => Promise<TemporaryCredentials>>();

function roleCredentials(roleArn: string, region: string): () => Promise<TemporaryCredentials> {
  let provider = assumedRoles.get(roleArn);
  if (!provider) {
    provider = lastingCredentials(awsCredentialsProvider({ roleArn, clientConfig: { region } }));
    assumedRoles.set(roleArn, provider);
  }
  return provider;
}

/**
 * An address signed with temporary credentials stops working when they expire, whatever its own validity says. The
 * SDK renews them only 5 minutes before they expire – an upload address signed then would die after 5 minutes. These
 * are renewed as soon as less than `CREDENTIALS_MUST_LAST_MS` is left, and again after a failed attempt; calls that
 * arrive while the role is being assumed wait for that one attempt. Marked `memoized`, so the SDK asks this provider
 * for every signature instead of caching its answer until 5 minutes before expiry (`normalizeCredentialProvider` in
 * `@aws-sdk/core`) – whether a client lives for one request or longer.
 */
export function lastingCredentials(
  assume: () => Promise<TemporaryCredentials>,
  now: () => number = Date.now,
): (() => Promise<TemporaryCredentials>) & { memoized: true } {
  let current: Promise<TemporaryCredentials> | undefined;
  const lasts = (credentials: TemporaryCredentials) =>
    (credentials.expiration?.getTime() ?? Number.POSITIVE_INFINITY) - now() > CREDENTIALS_MUST_LAST_MS;
  const provider = async () => {
    const pending = current;
    const credentials = await pending?.catch(() => undefined);
    if (credentials && lasts(credentials)) return credentials;
    // Another call renewed them while this one waited – take that attempt instead of assuming the role again.
    if (current !== pending) return current!;
    current = assume();
    return current;
  };
  return Object.assign(provider, { memoized: true as const });
}

import type { S3Settings } from "@/platform/storage";

/**
 * The bucket of the S3 adapter's integration tests (ST-099): locally `laguardia-test` on the SeaweedFS of
 * `docker-compose.yml` (`npm run db:up`) with its fixed development identity; CI starts the same and may set its own
 * through `TEST_S3_*`. Never the dev server's or the browser tests' bucket.
 */
export function testStoreSettings(): S3Settings {
  const environment = process.env;
  return {
    bucket: environment.TEST_S3_BUCKET ?? "laguardia-test",
    region: environment.TEST_S3_REGION ?? "us-east-1",
    endpoint: environment.TEST_S3_ENDPOINT ?? "http://localhost:8333",
    credentials: {
      accessKeyId: environment.TEST_S3_ACCESS_KEY_ID ?? "laguardia-dev",
      secretAccessKey: environment.TEST_S3_SECRET_ACCESS_KEY ?? "laguardia-dev-secret",
    },
  };
}

/** Fails with what to do when the test store is not running – instead of a timeout deep inside the SDK. */
export async function aReachableTestStore(): Promise<S3Settings> {
  const settings = testStoreSettings();
  try {
    await fetch(settings.endpoint!, { signal: AbortSignal.timeout(3000) });
  } catch {
    throw new Error(`No S3-compatible store at ${settings.endpoint} – start it with \`npm run db:up\``);
  }
  return settings;
}

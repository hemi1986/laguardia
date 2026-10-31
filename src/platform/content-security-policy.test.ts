import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { s3Settings, s3Storage, storeOrigin } from "@/platform/storage";
import { contentSecurityPolicy } from "./content-security-policy";

/**
 * The content security policy names the deployment's bucket (ST-099, ADR 0012): exactly the host the S3 adapter signs
 * its addresses for – virtual-hosted at the regional AWS endpoint, path-style with scheme and port at SeaweedFS.
 */
const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))!
    .split(" ")
    .slice(1);

/** Where the adapter's addresses for this deployment's bucket point – signed offline, no request to the store. */
async function addressOrigin(environment: Record<string, string>): Promise<string> {
  const storage = s3Storage({ settings: s3Settings(environment), clock: fixedClock("2026-10-31T10:00:00Z") });
  const [view] = (await storage.viewAddresses(["files/a"], new Date("2026-10-31T10:05:00Z"))).values();
  const upload = await storage.uploadAddress("files/b", {
    size: 3,
    contentType: "application/pdf",
    validUntil: new Date("2026-10-31T10:30:00Z"),
  });
  expect(new URL(upload.url).origin).toBe(new URL(view).origin);
  return new URL(view).origin;
}

const keys = { S3_ACCESS_KEY_ID: "AKIAEXAMPLE", S3_SECRET_ACCESS_KEY: "secret" };

describe("the content security policy", () => {
  it("ST-099: The content security policy names exactly the bucket's host", async () => {
    for (const environment of [
      { S3_BUCKET: "laguardia-production", S3_REGION: "eu-central-1", ...keys },
      { S3_BUCKET: "laguardia-dev", S3_REGION: "us-east-1", S3_ENDPOINT: "http://localhost:8333", ...keys },
    ]) {
      const origin = storeOrigin(s3Settings(environment)!);
      const policy = contentSecurityPolicy({ nonce: "n", development: false, storeOrigin: origin });

      expect(origin).toBe(await addressOrigin(environment));
      expect(directive(policy, "img-src")).toEqual(["'self'", "blob:", "data:", origin]);
      expect(directive(policy, "connect-src")).toEqual(["'self'", origin]);
      expect(policy).not.toMatch(/\*|vercel-storage|vercel\.com/);
    }
  });

  it("derives the regional, virtual-hosted AWS host and the local path-style origin", () => {
    expect(storeOrigin(s3Settings({ S3_BUCKET: "laguardia-preview", S3_REGION: "eu-central-1", ...keys })!)).toBe(
      "https://laguardia-preview.s3.eu-central-1.amazonaws.com",
    );
    expect(
      storeOrigin(
        s3Settings({
          S3_BUCKET: "laguardia-e2e",
          S3_REGION: "us-east-1",
          S3_ENDPOINT: "http://localhost:8333/",
          ...keys,
        })!,
      ),
    ).toBe("http://localhost:8333");
  });

  it("names no store when none is configured", () => {
    const policy = contentSecurityPolicy({ nonce: "n", development: false, storeOrigin: undefined });

    expect(directive(policy, "img-src")).toEqual(["'self'", "blob:", "data:"]);
    expect(directive(policy, "connect-src")).toEqual(["'self'"]);
  });

  it("takes credentials from an IAM role on Vercel, or from keys, and nothing without either", () => {
    const bucket = { S3_BUCKET: "laguardia-production", S3_REGION: "eu-central-1" };

    expect(s3Settings({ ...bucket, AWS_ROLE_ARN: "arn:aws:iam::1:role/r" })?.credentials).toEqual({
      roleArn: "arn:aws:iam::1:role/r",
    });
    expect(s3Settings({ ...bucket, ...keys })?.credentials).toEqual({
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secret",
    });
    expect(s3Settings(bucket)).toBeUndefined();
    expect(s3Settings({ S3_REGION: "eu-central-1", ...keys })).toBeUndefined();
  });
});

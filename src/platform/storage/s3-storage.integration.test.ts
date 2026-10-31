import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock, systemClock } from "@/platform/clock";
import { aReachableTestStore } from "@/test-support/object-store";
import type { S3Settings, UploadAddress } from ".";
import { s3Storage } from "./s3-storage";

/**
 * The S3 adapter of the storage seam (ST-099, ADR 0012) against SeaweedFS – the store of local development, the local
 * browser tests and CI, with a fixed identity, so it refuses unsigned and wrongly signed requests as AWS does. What the
 * browser does with an address is a plain `fetch` here. Expiry is shown by signing in the past (the adapter's clock).
 */
let settings: S3Settings;

beforeAll(async () => {
  settings = await aReachableTestStore();
});

const KB = 1000;
const MINUTE = 60 * 1000;
const aName = () => `files/${randomUUID()}`;
const storage = (clock = systemClock) => s3Storage({ settings, clock });
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * MINUTE);

/** What the browser does with an upload address: one PUT with the address's headers. */
function send(address: UploadAddress, bytes: Uint8Array, url = address.url): Promise<Response> {
  return fetch(url, { method: "PUT", headers: address.headers, body: bytes });
}

describe("the S3 adapter", () => {
  it("ST-099: Stored content is described and removed through the S3 adapter", async () => {
    const name = aName();
    await storage().write(name, new Uint8Array(1234), "application/pdf");

    expect(await storage().details(name)).toEqual({ size: 1234, contentType: "application/pdf" });

    await storage().delete(name);
    expect(await storage().details(name)).toBeUndefined();
  });

  it("ST-099: A browser upload stores the content under the name the server chose", async () => {
    const name = aName();
    const address = await storage().uploadAddress(name, {
      size: 500 * KB,
      contentType: "image/jpeg",
      validUntil: minutesFromNow(30),
    });

    const sent = await send(address, new Uint8Array(500 * KB));

    expect(sent.status).toBe(200);
    expect(await storage().details(name)).toEqual({ size: 500 * KB, contentType: "image/jpeg" });
  });

  it("ST-099: An upload address does not store content under another name", async () => {
    const name = aName();
    const other = aName();
    const address = await storage().uploadAddress(name, {
      size: 3,
      contentType: "application/pdf",
      validUntil: minutesFromNow(30),
    });

    const sent = await send(address, new Uint8Array(3), address.url.replace(name, other));

    expect(sent.status).toBe(403);
    expect(await storage().details(other)).toBeUndefined();
  });

  it("ST-099: An expired upload address stores nothing", async () => {
    const name = aName();
    const signedAt = new Date(Date.now() - 31 * MINUTE);
    const address = await storage(fixedClock(signedAt)).uploadAddress(name, {
      size: 3,
      contentType: "application/pdf",
      validUntil: new Date(signedAt.getTime() + 30 * MINUTE),
    });

    const sent = await send(address, new Uint8Array(3));

    expect(sent.status).toBe(403);
    expect(await storage().details(name)).toBeUndefined();
  });

  it("ST-099: Content longer than the declared size is refused by the store", async () => {
    const name = aName();
    const address = await storage().uploadAddress(name, {
      size: 500 * KB,
      contentType: "image/jpeg",
      validUntil: minutesFromNow(30),
    });

    const sent = await send(address, new Uint8Array(2000 * KB));

    expect(sent.status).toBe(403);
    expect(await storage().details(name)).toBeUndefined();
  });

  it("refuses content of another media type than the declared one", async () => {
    const name = aName();
    const address = await storage().uploadAddress(name, {
      size: 3,
      contentType: "application/pdf",
      validUntil: minutesFromNow(30),
    });

    const sent = await fetch(address.url, {
      method: "PUT",
      headers: { ...address.headers, "Content-Type": "text/html" },
      body: new Uint8Array(3),
    });

    expect(sent.status).toBe(403);
    expect(await storage().details(name)).toBeUndefined();
  });

  it("stores content under the name of an upload address only once", async () => {
    const name = aName();
    const address = await storage().uploadAddress(name, {
      size: 3,
      contentType: "application/pdf",
      validUntil: minutesFromNow(30),
    });
    expect((await send(address, new Uint8Array([1, 2, 3]))).status).toBe(200);

    const again = await send(address, new Uint8Array([4, 5, 6]));

    expect(again.status).toBe(412);
    const [view] = (await storage().viewAddresses([name], minutesFromNow(5))).values();
    expect(new Uint8Array(await (await fetch(view)).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("ST-099: Stored content is not delivered without a signed address", async () => {
    const name = aName();
    await storage().write(name, new Uint8Array([1, 2, 3]), "application/pdf");
    const [signed] = (await storage().viewAddresses([name], minutesFromNow(5))).values();
    const plain = new URL(signed);

    const delivered = await fetch(`${plain.origin}${plain.pathname}`);

    expect(delivered.status).toBe(403);
  });

  it("ST-099: A view address delivers the content until it expires", async () => {
    const name = aName();
    await storage().write(name, new Uint8Array([1, 2, 3]), "image/jpeg");

    const [view] = (await storage().viewAddresses([name], minutesFromNow(5))).values();
    const delivered = await fetch(view);
    expect(delivered.status).toBe(200);
    expect(new Uint8Array(await delivered.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    const signedAt = new Date(Date.now() - 6 * MINUTE);
    const [expired] = (
      await storage(fixedClock(signedAt)).viewAddresses([name], new Date(signedAt.getTime() + 5 * MINUTE))
    ).values();
    expect((await fetch(expired)).status).toBe(403);
  });

  it("ST-099: A download address sends the content to be saved, a view address to be opened", async () => {
    const zip = aName();
    const pdf = aName();
    await storage().write(zip, new Uint8Array([0x50, 0x4b, 3, 4]), "application/zip");
    await storage().write(pdf, new Uint8Array([0x25, 0x50, 0x44, 0x46]), "application/pdf");

    const [download] = (await storage().viewAddresses([zip], minutesFromNow(5), { download: true })).values();
    const [view] = (await storage().viewAddresses([pdf], minutesFromNow(5))).values();

    const saved = await fetch(download);
    const opened = await fetch(view);
    expect(saved.headers.get("content-disposition")).toBe("attachment");
    expect(opened.status).toBe(200);
    expect(opened.headers.get("content-disposition") ?? "").not.toContain("attachment");
  });

  it("lets the browser of the bucket's own origin upload across origins, and no other origin", async () => {
    const [view] = (await storage().viewAddresses([aName()], minutesFromNow(5))).values();
    const preflight = (origin: string) =>
      fetch(view, {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-type,if-none-match",
        },
      });

    const own = await preflight("http://localhost:3100");
    const foreign = await preflight("https://evil.example");

    expect(own.headers.get("access-control-allow-origin")).toBe("http://localhost:3100");
    expect(own.headers.get("access-control-allow-methods")).toContain("PUT");
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("gives one view address per name, all signed in one call", async () => {
    const names = [aName(), aName()];
    for (const name of names) await storage().write(name, new Uint8Array([1]), "image/jpeg");

    const addresses = await storage().viewAddresses(names, minutesFromNow(5));

    expect([...addresses.keys()]).toEqual(names);
    for (const address of addresses.values()) expect((await fetch(address)).status).toBe(200);
  });
});

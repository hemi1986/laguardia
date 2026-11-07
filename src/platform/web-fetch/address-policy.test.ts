import { describe, expect, it } from "vitest";
import { allowedWebAddress, isPublicIp } from "./address-policy";
import { ownHostsOf } from ".";

/** ST-129 / ADR 0019 decision 3: which addresses the server may fetch. */
describe("allowedWebAddress", () => {
  it.each([
    ["https://example.org/high-speed-manual.pdf", true],
    ["https://www.ipdb.org/files/1203/manual.pdf", true],
    ["https://93.184.216.34/manual.pdf", true],
    ["http://example.org/manual.pdf", false],
    ["ftp://example.org/manual.pdf", false],
    ["file:///etc/passwd", false],
    ["javascript:alert(1)", false],
    ["not an address", false],
    ["https://user:secret@example.org/manual.pdf", false],
    ["https://192.168.0.5/manual.pdf", false],
    ["https://10.0.0.1/", false],
    ["https://127.0.0.1/", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["https://[::1]/", false],
    ["https://[fd00::1]/", false],
    ["https://[::ffff:10.0.0.1]/", false],
    ["https://localhost/", false],
    ["https://localhost./", false],
    ["https://printer.local/", false],
    ["https://db.internal/", false],
    ["https://intranet/", false],
  ])("%s → %s", (address, allowed) => {
    expect(allowedWebAddress(address) !== undefined).toBe(allowed);
  });

  it("refuses the museum's own address, also in other letters", () => {
    expect(allowedWebAddress("https://museum.example/manual.pdf", ["Museum.example"])).toBeUndefined();
    expect(allowedWebAddress("https://other.example/manual.pdf", ["museum.example"])).toBeDefined();
  });
});

describe("isPublicIp", () => {
  it.each([
    ["8.8.8.8", true],
    ["93.184.216.34", true],
    ["2606:4700:4700::1111", true],
    ["0.0.0.0", false],
    ["10.1.2.3", false],
    ["100.64.0.1", false],
    ["172.16.0.1", false],
    ["172.32.0.1", true],
    ["192.168.1.1", false],
    ["198.18.0.1", false],
    ["224.0.0.1", false],
    ["255.255.255.255", false],
    ["::", false],
    ["::1", false],
    ["fe80::1", false],
    ["fc00::1", false],
    ["::ffff:192.168.0.5", false],
    ["::ffff:c0a8:5", false],
    ["::ffff:8.8.8.8", true],
    ["64:ff9b::10.0.0.1", false],
    ["not an ip", false],
  ])("%s → %s", (address, isPublic) => {
    expect(isPublicIp(address)).toBe(isPublic);
  });
});

describe("ownHostsOf", () => {
  it("takes the host names out of the environment's addresses", () => {
    expect(
      ownHostsOf({
        BETTER_AUTH_URL: "https://laguardia.example/",
        VERCEL_URL: "laguardia-abc.example.net",
        VERCEL_PROJECT_PRODUCTION_URL: "laguardia.example",
      }),
    ).toEqual(["laguardia.example", "laguardia-abc.example.net"]);
    expect(ownHostsOf({})).toEqual([]);
  });
});

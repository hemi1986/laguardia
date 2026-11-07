import { BlockList, isIP } from "node:net";

/**
 * Which web addresses the server may fetch (ST-129, ADR 0019 decision 3): `https` only, no login in the address, not a
 * name that only exists inside a network, not the museum's own address and not an address in a private network. A name
 * that *resolves* to a private address is stopped by the adapter's lookup (`isPublicIp`), because only the connection
 * knows what a name resolves to at that moment.
 */

const privateRanges = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  privateRanges.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  privateRanges.addSubnet(network, prefix, "ipv6");

/** Whether an IP address (v4 or v6) is a public one – anything else is on a private network, loopback or reserved. */
export function isPublicIp(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "").split("%")[0];
  const family = isIP(bare);
  if (family === 0) return false;
  if (family === 4) return !privateRanges.check(bare, "ipv4");
  const lower = bare.toLowerCase();
  // IPv4 embedded in IPv6 (::ffff:10.0.0.1, ::ffff:a00:1, 64:ff9b::10.0.0.1) is judged by the IPv4 address inside.
  const embedded = embeddedIpv4(lower);
  if (embedded) return isPublicIp(embedded);
  return !privateRanges.check(lower, "ipv6");
}

function embeddedIpv4(address: string): string | undefined {
  const match = /^(?:::ffff:|::|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(address);
  if (!match) return undefined;
  if (match[1]) return match[1];
  const high = parseInt(match[2], 16);
  const low = parseInt(match[3], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

/**
 * The URL when the server may fetch it, else undefined. `ownHosts` are the host names the museum's own deployment answers
 * to – an address on one is the museum's own address and never fetched, so a link cannot make the server call itself.
 */
export function allowedWebAddress(address: string, ownHosts: readonly string[] = []): URL | undefined {
  let url: URL;
  try {
    url = new URL(address.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
  if (!host) return undefined;
  if (isIP(host)) return isPublicIp(host) ? url : undefined;
  // A name without a dot lives inside a network; these suffixes never name a public site.
  if (!host.includes(".") || /\.(localhost|local|internal|intranet|lan|home|corp|private)$/.test(host))
    return undefined;
  if (ownHosts.some((own) => own.toLowerCase() === host)) return undefined;
  return url;
}

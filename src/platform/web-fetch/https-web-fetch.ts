import "server-only";
import { lookup as dnsLookup } from "node:dns";
import type { LookupFunction } from "node:net";
import { request as httpsRequest } from "node:https";
import { allowedWebAddress, isPublicIp } from "./address-policy";
import type { WebFetcher, WebFetchResult } from ".";

/**
 * The real adapter of the web-fetch seam (ST-129, ADR 0019 decision 3). Every hop – the address given and each redirect –
 * goes through the address policy and a connection whose DNS lookup refuses a private address, so neither a redirect nor
 * a name pointing into the museum's network leads inside. Redirects are followed by hand (at most five). What comes back is
 * bytes and a media type; nothing of it is interpreted here.
 */

/** One answer of one hop: the status, the headers that matter and the body, read at most up to a limit by the caller. */
export type HopAnswer = {
  status: number;
  location?: string;
  contentType?: string;
  contentLength?: number;
  body: AsyncIterable<Uint8Array>;
  /** Ends the connection – called when the caller stops reading. */
  close(): void;
};

/** Fetches one address, one hop, never following a redirect. A refused connection address throws `AddressRefused`. */
export type Transport = (url: URL, signal: AbortSignal) => Promise<HopAnswer>;

/** The connection went to a private address – the name resolved to one. */
export class AddressRefused extends Error {}

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 60_000;

export function webFetcher({
  transport = httpsTransport,
  ownHosts = [],
  timeoutMs = TIMEOUT_MS,
}: {
  transport?: Transport;
  ownHosts?: readonly string[];
  timeoutMs?: number;
} = {}): WebFetcher {
  return {
    async fetch(address, { maxBytes }): Promise<WebFetchResult> {
      const signal = AbortSignal.timeout(timeoutMs);
      let url = allowedWebAddress(address, ownHosts);
      for (let hops = 0; url; hops++) {
        if (hops > MAX_REDIRECTS) return { ok: false, reason: "not-reachable" };
        let answer: HopAnswer;
        try {
          answer = await transport(url, signal);
        } catch (error) {
          return { ok: false, reason: error instanceof AddressRefused ? "address-not-allowed" : "not-reachable" };
        }
        if (answer.status >= 300 && answer.status < 400 && answer.location) {
          answer.close();
          // A redirect to an address that is not allowed ends the fetch there (also a relative one is resolved first).
          const target = relativeTo(url, answer.location);
          url = target ? allowedWebAddress(target, ownHosts) : undefined;
          if (!url) return { ok: false, reason: "address-not-allowed" };
          continue;
        }
        if (answer.status !== 200) {
          answer.close();
          return { ok: false, reason: "not-reachable" };
        }
        return readBody(answer, maxBytes);
      }
      return { ok: false, reason: "address-not-allowed" };
    },
  };
}

function relativeTo(base: URL, location: string): string | undefined {
  try {
    return new URL(location, base).href;
  } catch {
    return undefined;
  }
}

async function readBody(answer: HopAnswer, maxBytes: number): Promise<WebFetchResult> {
  if (answer.contentLength !== undefined && answer.contentLength > maxBytes) {
    answer.close();
    return { ok: false, reason: "too-large" };
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for await (const chunk of answer.body) {
      size += chunk.length;
      if (size > maxBytes) {
        answer.close();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(chunk);
    }
  } catch {
    return { ok: false, reason: "not-reachable" };
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return { ok: true, contentType: answer.contentType ?? "", bytes };
}

/**
 * A DNS lookup that refuses a name resolving to a private address. Node asks for it at the moment it connects, so the
 * address checked is the address connected to – no second resolution in between that could answer differently.
 */
export const refusingPrivateLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIp(address))) {
      return callback(new AddressRefused("private address"), "", 4);
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};

const httpsTransport: Transport = (url, signal) =>
  new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: "GET",
        lookup: refusingPrivateLookup,
        signal,
        headers: { accept: "application/pdf, text/markdown, text/plain, text/html;q=0.8", "user-agent": "La-Guardia" },
      },
      (response) => {
        const length = Number(response.headers["content-length"]);
        resolve({
          status: response.statusCode ?? 0,
          location: response.headers.location,
          contentType: response.headers["content-type"],
          ...(Number.isFinite(length) && response.headers["content-length"] !== undefined && { contentLength: length }),
          body: response,
          close: () => response.destroy(),
        });
      },
    );
    req.on("error", (error) => reject(error.cause instanceof AddressRefused ? error.cause : error));
    req.end();
  });

import { allowedWebAddress } from "./address-policy";
import type { WebFetcher, WebFetchResult } from ".";

/** What an address answers in `memoryWeb`: content (`size` stands for a body larger than `bytes`), or nothing at all. */
export type MemoryWebAnswer = { contentType: string; bytes: Uint8Array; size?: number } | "unreachable";

export type MemoryWeb = WebFetcher & {
  /** The addresses that were really answered – an address the policy refuses is never among them. */
  served(): string[];
};

/**
 * The in-memory adapter of the web-fetch seam (ST-129): integration tests use it, so they never reach the internet. It
 * applies the same address policy and size limit as the real adapter, so a test of "nothing was fetched" means it.
 */
export function memoryWeb(answers: Record<string, MemoryWebAnswer>, ownHosts: readonly string[] = []): MemoryWeb {
  const served: string[] = [];
  return {
    async fetch(address, { maxBytes }): Promise<WebFetchResult> {
      if (!allowedWebAddress(address, ownHosts)) return { ok: false, reason: "address-not-allowed" };
      const answer = answers[address];
      if (!answer || answer === "unreachable") return { ok: false, reason: "not-reachable" };
      served.push(address);
      if ((answer.size ?? answer.bytes.length) > maxBytes) return { ok: false, reason: "too-large" };
      return { ok: true, contentType: answer.contentType, bytes: answer.bytes };
    },
    served: () => [...served],
  };
}

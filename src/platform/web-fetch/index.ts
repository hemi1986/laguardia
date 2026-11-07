/**
 * The web-fetch seam (ST-129, ADR 0019 decision 3): the one place outside OpenRouter where the server fetches a web
 * address a person did not type into the museum's own forms. One interface, two adapters – `httpsWebFetch` on a real
 * deployment, `memoryWeb` in tests – injected like the storage seam. The seam holds the limits, whoever asks:
 * only `https`, never the museum's own address or a private network (also not after a redirect, also not when a name
 * resolves to one), a size limit, and nothing from the content is ever executed – it comes back as bytes.
 */

/** Why an address could not be fetched – the reasons of `EVT-ProposedDocumentFailed` that the fetch itself can tell. */
export type WebFetchFailure = "not-reachable" | "too-large" | "address-not-allowed";

export type WebFetchResult =
  | { ok: true; contentType: string; bytes: Uint8Array }
  | { ok: false; reason: WebFetchFailure };

export type WebFetcher = {
  /** Fetches the content behind an address, up to `maxBytes`; it never throws for what the web does. */
  fetch(address: string, options: { maxBytes: number }): Promise<WebFetchResult>;
};

export { allowedWebAddress, isPublicIp } from "./address-policy";
export { memoryWeb, type MemoryWeb } from "./memory-web";
export { webFetcher, AddressRefused, type HopAnswer, type Transport } from "./https-web-fetch";

/** The host names the museum's own deployment answers to – from the environment; an address on one is never fetched. */
export function ownHostsOf(env: Record<string, string | undefined>): string[] {
  const hosts = [env.BETTER_AUTH_URL, env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL].flatMap(
    (value) => {
      if (!value) return [];
      try {
        return [new URL(value.includes("://") ? value : `https://${value}`).hostname];
      } catch {
        return [];
      }
    },
  );
  return [...new Set(hosts)];
}

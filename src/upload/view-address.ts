import "server-only";
import type { Clock } from "@/platform/clock";
import type { ContentStorage } from "@/platform/storage";

/** How long an address for opening uploaded content is valid (ADR 0006). */
const VIEW_MINUTES = 5;

/**
 * An address to open uploaded content, valid for 5 minutes from the injected clock's time (ADR 0006) – only after the
 * page's access check; the content's plain store address does not deliver it. Nothing for a name that is not one the
 * upload module gives.
 */
export async function viewAddressOf(storage: ContentStorage, clock: Clock, name: string): Promise<string | undefined> {
  if (!/^files\/[0-9a-f-]{36}$/.test(name)) return undefined;
  const validUntil = new Date(clock.now().getTime() + VIEW_MINUTES * 60 * 1000);
  return (await storage.viewAddresses([name], validUntil)).get(name);
}

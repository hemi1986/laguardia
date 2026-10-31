import { museumLogo } from "@/modules/collection";
import { photoViewAddresses } from "@/photo";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { ContentStorage } from "@/platform/storage";

/** How long the browser may reuse the sending-on (user, 2026-10-31): a replaced logo shows at most a minute longer. */
const REUSE_SECONDS = 60;

/**
 * The public address `/logo` (ST-102) – the one exception to "only team pages issue view addresses" (HS-1): the logo is
 * public by nature. No login; it checks only whether there is a logo and sends the browser on to a fresh view address
 * of the private store, valid 5 minutes – as `/team/dateien/<id>` does for team members. The browser (never a shared
 * cache) may keep the sending-on for 60 seconds, so the logo is not downloaded on every page view. Without a logo – or
 * when the store cannot sign – it is not found.
 */
export function logoRoute({ db, storage, clock }: { db: Database; storage: ContentStorage; clock: Clock }) {
  return async (_request: Request): Promise<Response> => {
    const logo = await museumLogo(db);
    const address = logo && (await photoViewAddresses(storage, clock, [logo])).get(logo);
    if (!address) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(null, {
      status: 307,
      headers: { Location: address, "Cache-Control": `private, max-age=${REUSE_SECONDS}` },
    });
  };
}

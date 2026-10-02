import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTechnician } from "@/app/team-session";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { L7160, StickerSheet } from "@/app/(team)/team/machines/stickers/sticker-sheet";
import { stickersFor } from "@/app/(team)/team/machines/stickers/stickers-data";
import { PrintButton } from "./print-button";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * The printable QR sticker pages (ST-011) for the chosen machines, on Avery Zweckform L7160. Without a chosen machine
 * there is no page – the technician is sent back to choose at least one.
 */
export default async function PrintStickersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireTechnician();
  const params = await searchParams;
  const chosen = params.m;
  const search = typeof params.search === "string" ? params.search : undefined;
  const back = `/team/machines/stickers${search ? `?search=${encodeURIComponent(search)}` : ""}`;
  const stickers = await stickersFor(database(), Array.isArray(chosen) ? chosen : chosen ? [chosen] : []);
  if (stickers.length === 0) redirect(`${back}${search ? "&" : "?"}error=none`);

  return (
    <main>
      <div className="print:hidden flex flex-wrap items-center gap-3 p-4">
        <PrintButton label={teamMessages.stickers.printNow} />
        <Link href={back} className="text-sm underline underline-offset-4">
          {teamMessages.stickers.back}
        </Link>
        <span className="text-sm">{teamMessages.stickers.chosen(stickers.length)}</span>
      </div>
      <StickerSheet sheet={L7160} stickers={stickers} />
    </main>
  );
}

import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { MachineSearch } from "../machine-search";
import { StickerChoice } from "./sticker-choice";
import { stickerChoiceFor } from "./stickers-data";

const { stickers: texts, machines: machineTexts } = teamMessages;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * Choosing the machines to print QR stickers for (ST-011) – technicians only; retired machines are not offered. The
 * machines come in groups that fold (ST-098); a search is a reload of the page, so it starts a new choice.
 */
export default async function StickersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireTechnician();
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : undefined;
  const groups = await stickerChoiceFor(database(), { search });

  return (
    <Page title={texts.title}>
      <p className="text-muted-foreground text-sm">{texts.sheet}</p>
      <MachineSearch action="/team/machines/stickers" search={search} />
      {groups.length === 0 ? (
        <p>{search ? machineTexts.noMatch(search) : machineTexts.empty}</p>
      ) : (
        <StickerChoice groups={groups} search={search} noneChosen={params.error === "none"} />
      )}
    </Page>
  );
}

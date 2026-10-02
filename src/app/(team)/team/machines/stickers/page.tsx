import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { StickerChoice } from "./sticker-choice";
import { machinesToPrintFor } from "./stickers-data";

const { stickers: texts, machines: machineTexts } = teamMessages;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** Choosing the machines to print QR stickers for (ST-011) – technicians only; retired machines are not offered. */
export default async function StickersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireTechnician();
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : undefined;
  const machines = await machinesToPrintFor(database(), { search });

  return (
    <Page title={texts.title} wide>
      <p className="text-muted-foreground text-sm">{texts.sheet}</p>
      <form action="/team/machines/stickers" className="flex gap-2" role="search">
        <label htmlFor="search" className="sr-only">
          {machineTexts.search}
        </label>
        <Input id="search" name="search" type="search" defaultValue={search} placeholder={machineTexts.searchHint} />
        <button type="submit" className={buttonVariants({ variant: "outline" })}>
          {machineTexts.searchSubmit}
        </button>
      </form>
      {machines.length === 0 ? (
        <p>{search ? machineTexts.noMatch(search) : machineTexts.empty}</p>
      ) : (
        <StickerChoice machines={machines} search={search} noneChosen={params.error === "none"} />
      )}
    </Page>
  );
}

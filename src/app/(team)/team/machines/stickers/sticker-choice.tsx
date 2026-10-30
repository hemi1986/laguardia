"use client";

import { useState } from "react";
import { Rejection } from "@/components/ui/message";
import { Button } from "@/components/ui/button";
import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { TeamGroupedChoice } from "../../team-grouped-choice";
import { teamMessages } from "@/platform/messages";

const { stickers: texts } = teamMessages;

/**
 * Choosing the machines to print QR stickers for (ST-011): a plain GET form to the print page, so it works without
 * JavaScript; with JavaScript the number of chosen machines is shown next to the way to print. The machines sit in
 * groups that fold (ST-098, G27) – closed when the page opens, opened when they hold the matches of a search.
 */
export function StickerChoice({
  groups,
  search,
  noneChosen,
}: {
  groups: ChoiceGroup[];
  search: string | undefined;
  /** The last print asked for no machine – said right above the button (G8). */
  noneChosen: boolean;
}) {
  // Undefined until the page is interactive – the browser may restore ticked boxes (back button), counted then.
  const [chosen, setChosen] = useState<number | undefined>(undefined);

  return (
    <form action="/team/machines/stickers/print" method="get" className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{texts.choose}</legend>
        <TeamGroupedChoice
          name="m"
          groups={groups}
          chosen={[]}
          open={!!search}
          onChosenChange={(now) => setChosen(now.size)}
        />
      </fieldset>
      {search && <input type="hidden" name="search" value={search} />}
      {noneChosen && <Rejection>{texts.noneChosen}</Rejection>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{texts.print}</Button>
        <span role="status" className="text-sm">
          {chosen === undefined ? texts.chosenWithoutScript : texts.chosen(chosen)}
        </span>
      </div>
    </form>
  );
}

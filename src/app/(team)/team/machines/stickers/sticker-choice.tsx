"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { MachineOverviewEntry } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";

const { stickers: texts } = teamMessages;

/**
 * Choosing the machines to print QR stickers for (ST-011): a plain GET form to the print page, so it works without
 * JavaScript; with JavaScript the number of chosen machines is shown next to the way to print.
 */
export function StickerChoice({ machines }: { machines: Pick<MachineOverviewEntry, "id" | "museumNumber" | "machineModelTitle">[] }) {
  const [chosen, setChosen] = useState<number | undefined>(undefined);

  return (
    <form
      action="/team/machines/stickers/print"
      method="get"
      className="flex flex-col gap-4"
      onChange={(event) => setChosen(event.currentTarget.querySelectorAll("input[name=m]:checked").length)}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{texts.choose}</legend>
        {machines.map((machine) => (
          <label key={machine.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="m" value={machine.museumNumber} className="size-5" />
            {machine.museumNumber} · {machine.machineModelTitle}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">{texts.print}</Button>
        <span role="status" className="text-sm">
          {chosen === undefined ? texts.chosenWithoutScript : texts.chosen(chosen)}
        </span>
      </div>
    </form>
  );
}

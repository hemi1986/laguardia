import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { groupMachines, machineOverview, type MachineOverviewQuery } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { machineChoiceGroups } from "../../category-and-technology";
import { qrCodeImage } from "./qr-sticker";
import type { Sticker } from "./sticker-sheet";

/**
 * The machines a technician chooses stickers for (ST-011): the active machines – a retired one gets no sticker –,
 * narrowed by museum number or machine model title exactly like the machine overview (RM-MachineOverview).
 */
export function machinesToPrintFor(db: Database, query: Pick<MachineOverviewQuery, "search">) {
  return machineOverview(db, query);
}

/**
 * The sticker selection in groups that fold (ST-098, G27): the machines to print for, grouped by machine category and
 * technology, each „LG-042 · Medieval Madness“ and posted as its museum number. A search leaves only the groups with a
 * match, holding only the matches.
 */
export async function stickerChoiceFor(
  db: Database,
  query: Pick<MachineOverviewQuery, "search">,
): Promise<ChoiceGroup[]> {
  return machineChoiceGroups(
    groupMachines(await machinesToPrintFor(db, query)),
    ({ museumNumber, machineModelTitle }) => ({
      value: museumNumber,
      label: `${museumNumber} · ${machineModelTitle}`,
    }),
  );
}

/**
 * The stickers of the chosen museum numbers: active machines only, each once, sorted by museum number. Anything else
 * in the address – a retired machine, an unknown or repeated number – is passed over.
 */
export async function stickersFor(db: Database, museumNumbers: readonly string[]): Promise<Sticker[]> {
  const chosen = new Set(museumNumbers);
  const machines = (await machineOverview(db)).filter((machine) => chosen.has(machine.museumNumber));
  return Promise.all(
    machines.map(async ({ museumNumber }) => ({ museumNumber, qrCode: await qrCodeImage(museumNumber) })),
  );
}

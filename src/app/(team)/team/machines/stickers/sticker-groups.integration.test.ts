import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createMachineModelCommand,
  registerMachineCommand,
  type MachineCategory,
  type Technology,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { StickerChoice } from "./sticker-choice";
import { stickerChoiceFor } from "./stickers-data";

/** The sticker selection in groups that fold (ST-098, G27) – in a database of its own, so the counts are exact. */
const isolated = isolatedTestDatabase("sticker_groups");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva);
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

/** Machines of a machine model of their own with that title, machine category and technology, numbered from `first`. */
async function registered(
  count: number,
  first: number,
  { title, machineCategory, technology }: { title: string; machineCategory: MachineCategory; technology: Technology },
) {
  const created = await executeCommand(
    createMachineModelCommand,
    { title: `${title} ${randomUUID()}`, manufacturer: "Williams", machineCategory, technology },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  for (let number = first; number < first + count; number++) {
    const outcome = await executeCommand(
      registerMachineCommand,
      {
        machineModelId: created.result.machineModelId,
        museumNumber: `LG-${String(number).padStart(3, "0")}`,
        serialNumber: undefined,
        location: "Hall 1",
        machineStatus: "playable",
      },
      { actor: eva, db, newId: randomUUID },
    );
    if (!outcome.ok) throw new Error(outcome.error);
  }
}

/** The sticker selection as the page renders it, searched for `search`. */
async function selection(search?: string) {
  return renderToStaticMarkup(
    createElement(StickerChoice, { groups: await stickerChoiceFor(db, { search }), search, noneChosen: false }),
  );
}

/** Each fold of the selection: its header and whether it is open. */
function foldsOf(html: string) {
  return html
    .split("<details")
    .slice(1)
    .map((fold) => ({
      header: fold.match(/<summary[^>]*><span>([^<]*)<\/span>/)![1],
      open: /^[^>]* open/.test(fold),
    }));
}

describe("the sticker selection in groups (ST-098)", () => {
  it("ST-098: The sticker selection is grouped and closed", async () => {
    await registered(4, 50, { title: "Galaxian", machineCategory: "arcade", technology: "crt" });
    await registered(10, 30, { title: "Medieval Madness", machineCategory: "pinball", technology: "dmd" });
    await registered(6, 1, { title: "Fireball", machineCategory: "pinball", technology: "em" });

    const html = await selection();

    expect(foldsOf(html)).toEqual([
      { header: "Flipper · EM – 0 von 6 ausgewählt", open: false },
      { header: "Flipper · DMD – 0 von 10 ausgewählt", open: false },
      { header: "Arcade · CRT – 0 von 4 ausgewählt", open: false },
    ]);
    expect(html).toMatch(/LG-001 · Fireball [0-9a-f-]+<\/span>/);
  });

  it("ST-098: A search shows only the groups with a match, opened", async () => {
    await registered(6, 1, { title: "Fireball", machineCategory: "pinball", technology: "em" });
    await registered(1, 42, { title: "Medieval Madness", machineCategory: "pinball", technology: "dmd" });
    await registered(2, 43, { title: "Attack from Mars", machineCategory: "pinball", technology: "dmd" });

    const html = await selection("medieval");

    expect(foldsOf(html)).toEqual([{ header: "Flipper · DMD – 0 von 1 ausgewählt", open: true }]);
    expect(html).toContain('value="LG-042"');
    expect(html).not.toContain('value="LG-043"');
    expect(html).not.toContain("Flipper · EM");
  });
});

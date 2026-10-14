import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { fiveYearsOfRepairHistory } from "@/test-support/repair-history";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";
import { loadRepairHistory } from "./reparaturhistorie/repair-history-data";
import { RepairHistoryView } from "./reparaturhistorie/repair-history";

/**
 * The machine record with five years of realistic repair history (ST-033, vision success criterion): what the QR
 * address leads a team member to – the machine status and the most recent repairs, on one page – loads in under 2
 * seconds. Measured on the page's data and its rendering against a database of its own (user, 2026-10-14); the browser
 * test checks the QR address itself, without timing – a dev server compiling on the first request says nothing.
 */
const isolated = isolatedTestDatabase("machine_record_load");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const NOW = "2026-10-14T10:00:00Z";

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!model.ok) throw new Error(model.error);
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: model.result.machineModelId,
      museumNumber: "LG-042",
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    { actor: eva, db, clock: fixedClock("2021-09-01T09:00:00Z"), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  const counts = await fiveYearsOfRepairHistory(db, {
    machineId: registered.result.machineId,
    technician: eva,
    helper: anna,
    until: NOW,
  });
  // What "realistic" was agreed to mean (user, 2026-10-14).
  expect(counts).toEqual({ defects: 144, resolvedOnTheSpot: 87, dismissed: 29 });
}, 180_000);

afterAll(() => isolated.close());

/** How long the function takes, in milliseconds – the slower of two runs, the first one warming nothing up for it. */
async function millisecondsOf(work: () => Promise<unknown>): Promise<number> {
  const times: number[] = [];
  for (let run = 0; run < 2; run++) {
    const start = performance.now();
    await work();
    times.push(performance.now() - start);
  }
  return Math.max(...times);
}

describe("the machine record with five years of repair history", () => {
  // The QR address itself – `/m/LG-042` leading a team member to this page – is checked in the browser:
  // `e2e/repair-history.spec.ts` (and ST-011's `e2e/qr-sticker.spec.ts`). Here: what that page shows, and how fast.
  it("ST-033: Status and history directly from the QR address", async () => {
    let html = "";
    const elapsed = await millisecondsOf(async () => {
      const record = await loadMachineRecord(db, "LG-042", {
        clock: fixedClock(NOW),
        viewer: { id: eva.teamMemberId, role: "technician" },
      });
      html = renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber: "LG-042" }));
    });

    // The machine status and the repair history, without further navigation.
    expect(html).toContain("Spielbereit");
    expect(html).toContain("Reparaturhistorie");
    expect(html).toContain("Ball freed, playfield cleaned");
    expect(html).toContain("Offene Defekte");
    expect(html).toContain("Ganze Reparaturhistorie (231)");
    expect(elapsed).toBeLessThan(2000);
  });

  it("loads a year of the whole repair history in under 2 seconds too", async () => {
    const elapsed = await millisecondsOf(async () => {
      const data = await loadRepairHistory(db, "LG-042", "2025");
      renderToStaticMarkup(createElement(RepairHistoryView, { data, museumNumber: "LG-042" }));
    });

    expect(elapsed).toBeLessThan(2000);
  });
});

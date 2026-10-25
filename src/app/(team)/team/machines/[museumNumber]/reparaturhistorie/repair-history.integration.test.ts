import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import {
  linkProblemReportToDefectCommand,
  logWorkCommand,
  recordDefectCommand,
  reportProblemCommand,
  reopenDefectCommand,
  resolveDefectCommand,
  resolveProblemOnTheSpotCommand,
  retireMachineCommand,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadRepairHistory } from "./repair-history-data";
import { RepairHistoryView } from "./repair-history";

/**
 * The repair history's own page (RM-MachineRecord, ST-033): the years first, each with how many entries it has (G4a);
 * a chosen year with its defects – work log entries and closing note – and its problems resolved on the spot. Repair's
 * repair history with Collection's machine and Team's names – the page composes (ST-009). In a database of its own, so
 * the machine can be "LG-042".
 */
const isolated = isolatedTestDatabase("repair_history");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let lg042: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  const model = await executeCommand(
    createMachineModelCommand,
    { title: `Medieval Madness ${randomUUID()}`, manufacturer: "Williams", machineCategory: "pinball" },
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
    { actor: eva, db, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  lg042 = registered.result.machineId;
});

async function run<Result>(outcome: Promise<{ ok: true; result: Result } | { ok: false; error: string }>) {
  const done = await outcome;
  if (!done.ok) throw new Error(done.error);
  return done.result;
}

const as = (actor: typeof eva | typeof anna, at: string) => ({ actor, db, clock: fixedClock(at), newId: randomUUID });

/** A problem report a visitor sends for LG-042 – untriaged, at version 0. */
const reported = (description: string, at: string) =>
  run(
    executeCommand(
      reportProblemCommand,
      { machineId: lg042, description },
      { ...as(eva, at), actor: { kind: "visitor" } },
    ),
  );

/** A defect of LG-042, recorded by Eva through triage – at version 0. */
async function aDefect(title: string, at: string) {
  const { problemReportId } = await reported(`${title} – reported`, at);
  const recorded = await run(
    executeCommand(
      recordDefectCommand,
      {
        problemReportId,
        version: 0,
        title,
        priority: "normal",
        suitableForHelpers: true,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      as(eva, at),
    ),
  );
  return recorded.defectId!;
}

async function page(year?: string): Promise<string> {
  const data = await loadRepairHistory(db, "LG-042", year, {
    clock: fixedClock("2026-10-25T10:00:00Z"),
    storage: memoryStorage(),
  });
  return renderToStaticMarkup(createElement(RepairHistoryView, { data, museumNumber: "LG-042" }));
}

describe("the repair history's own page", () => {
  it("ST-033: Repair history shows defects with their work log entries", async () => {
    const coinDoor = await aDefect("Coin door jammed", "2026-09-01T08:00:00Z");
    await run(
      executeCommand(
        logWorkCommand,
        { defectId: coinDoor, version: 0, whatWasDone: "Lock oiled", partsUsed: "" },
        as(anna, "2026-09-02T10:00:00Z"),
      ),
    );
    await run(
      executeCommand(
        logWorkCommand,
        { defectId: coinDoor, version: 1, whatWasDone: "Lock taken apart", partsUsed: "Lock 27 mm" },
        as(eva, "2026-09-03T10:00:00Z"),
      ),
    );
    await run(
      executeCommand(
        resolveDefectCommand,
        { defectId: coinDoor, version: 2, closingNote: "Lock replaced" },
        as(eva, "2026-09-04T10:00:00Z"),
      ),
    );

    const html = await page("2026");

    const entry = html.slice(html.indexOf("Coin door jammed")).split("</article>")[0];
    expect(entry).toContain("Lock oiled");
    expect(entry).toContain("Anna · 02.09.2026, 12:00");
    expect(entry).toContain("Lock taken apart");
    expect(entry).toContain("Verwendete Teile: Lock 27 mm");
    expect(entry).toContain("Eva · 03.09.2026, 12:00");
    expect(entry).toContain("Abschlussnotiz");
    expect(entry).toContain("Lock replaced");
    expect(entry).toContain("Behoben von Eva am 04.09.2026, 12:00");
    expect(html).toMatch(new RegExp(`<a [^>]*href="/team/defects/${coinDoor}"[^>]*>Coin door jammed</a>`));
  });

  it("ST-032: Photos are shown on the repair history", async () => {
    const flipper = await aDefect("Left flipper weak", "2026-09-01T08:00:00Z");
    await run(
      executeCommand(
        logWorkCommand,
        {
          defectId: flipper,
          version: 0,
          whatWasDone: "Replaced coil stop",
          partsUsed: "",
          photos: ["work-log/before.jpg", "work-log/after.jpg"],
        },
        as(anna, "2026-09-02T10:00:00Z"),
      ),
    );

    const html = await page("2026");

    // Under the entry – before its work log ends.
    const entry = html.slice(html.indexOf("Replaced coil stop")).split("</ol>")[0];
    expect(entry).toContain('src="memory://work-log/before.jpg');
    expect(entry).toContain('src="memory://work-log/after.jpg');
  });

  it("ST-030: Repair history shows every resolution of a reopened defect and the reopen reason", async () => {
    const flipper = await aDefect("Left flipper weak", "2026-09-01T08:00:00Z");
    await run(
      executeCommand(
        resolveDefectCommand,
        { defectId: flipper, version: 0, closingNote: "Coil replaced" },
        as(eva, "2026-09-02T10:00:00Z"),
      ),
    );
    await run(
      executeCommand(
        reopenDefectCommand,
        { defectId: flipper, version: 1, reason: "Weak again" },
        as(anna, "2026-09-05T10:00:00Z"),
      ),
    );

    const html = await page("2026");

    const entry = html.slice(html.indexOf("Left flipper weak")).split("</article>")[0];
    expect(entry).toContain("Coil replaced");
    expect(entry).toContain("Wieder geöffnet von Anna am 05.09.2026, 12:00");
    expect(entry).toContain("Weak again");
    expect(entry.indexOf("Coil replaced")).toBeLessThan(entry.indexOf("Weak again"));
  });

  it("shows a defect reopened by a linked problem report with that problem report as the reason (ST-053)", async () => {
    const flipper = await aDefect("Left flipper weak", "2026-09-01T08:00:00Z");
    await run(
      executeCommand(
        resolveDefectCommand,
        { defectId: flipper, version: 0, closingNote: "Coil replaced" },
        as(eva, "2026-09-02T10:00:00Z"),
      ),
    );
    const { problemReportId } = await reported("Left flipper dead again", "2026-09-05T09:00:00Z");
    await run(
      executeCommand(
        linkProblemReportToDefectCommand,
        { problemReportId, version: 0, defectId: flipper, resolvedDefectVersion: 1 },
        as(eva, "2026-09-05T10:00:00Z"),
      ),
    );

    const html = await page("2026");

    const entry = html.slice(html.indexOf("Left flipper weak")).split("</article>")[0];
    expect(entry).toContain("Wieder geöffnet von Eva am 05.09.2026, 12:00");
    expect(entry).toContain("Wegen der Meldung: „Left flipper dead again“");
    expect(entry.indexOf("Coil replaced")).toBeLessThan(entry.indexOf("Wegen der Meldung"));
  });

  it("ST-030: Repair history keeps the order of several resolutions and reopenings", async () => {
    const flipper = await aDefect("Left flipper weak", "2026-09-01T08:00:00Z");
    const step = (command: Promise<unknown>) => run(command as Promise<{ ok: true; result: unknown }>);
    await step(
      executeCommand(
        resolveDefectCommand,
        { defectId: flipper, version: 0, closingNote: "Coil replaced" },
        as(eva, "2026-09-02T10:00:00Z"),
      ),
    );
    await step(
      executeCommand(
        reopenDefectCommand,
        { defectId: flipper, version: 1, reason: "Weak again" },
        as(anna, "2026-09-05T10:00:00Z"),
      ),
    );
    await step(
      executeCommand(
        resolveDefectCommand,
        { defectId: flipper, version: 2, closingNote: "Flipper rebuilt" },
        as(eva, "2026-09-08T10:00:00Z"),
      ),
    );
    await step(
      executeCommand(
        reopenDefectCommand,
        { defectId: flipper, version: 3, reason: "Sticks when warm" },
        as(anna, "2026-09-12T10:00:00Z"),
      ),
    );

    const entry = (await page("2026")).split("Left flipper weak")[1].split("</article>")[0];

    const order = ["Coil replaced", "Weak again", "Flipper rebuilt", "Sticks when warm"].map((text) =>
      entry.indexOf(text),
    );
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the years first, each with its number of entries – the newest first", async () => {
    await aDefect("Coin door jammed", "2025-03-01T08:00:00Z");
    await aDefect("Left flipper weak", "2026-02-01T08:00:00Z");
    const ball = await reported("Ball stuck", "2026-05-01T08:00:00Z");
    await run(
      executeCommand(
        resolveProblemOnTheSpotCommand,
        { problemReportId: ball.problemReportId, version: 0, note: "Ball freed" },
        as(anna, "2026-05-01T08:10:00Z"),
      ),
    );
    // New Year's Eve in Berlin is already the next year.
    await aDefect("Display flickers", "2024-12-31T23:30:00Z");

    const years = await page();

    expect(years).toMatch(/href="\/team\/machines\/LG-042\/reparaturhistorie\?jahr=2026"[^>]*>2026 · 2 Einträge</);
    expect(years).toMatch(/href="\/team\/machines\/LG-042\/reparaturhistorie\?jahr=2025"[^>]*>2025 · 2 Einträge</);
    expect(years).not.toContain(">2024");
    expect(years.indexOf("2026 · ")).toBeLessThan(years.indexOf("2025 · "));
    // The entries come after the choice (G4a).
    expect(years).not.toContain("Left flipper weak");

    const of2026 = await page("2026");
    expect(of2026.indexOf("Ball freed")).toBeLessThan(of2026.indexOf("Left flipper weak"));
    expect(of2026).toContain("Direkt behoben");
    expect(of2026).toContain("Anna · 01.05.2026, 10:10");
    // An open defect is part of the repair history, and says it is open.
    expect(of2026.slice(of2026.indexOf("Left flipper weak")).split("</article>")[0]).toContain("Offen");
    expect(of2026).not.toContain("Coin door jammed");
  });

  it("says so for a machine with nothing repaired, and for an unknown machine", async () => {
    expect(await page()).toContain("An diesem Gerät wurde noch nichts repariert.");
    expect(await loadRepairHistory(db, "LG-999")).toBeUndefined();
  });

  it("ST-039: Defects closed on retirement are shown as such in the repair history", async () => {
    await aDefect("Display dead", "2026-09-01T08:00:00Z");
    const coinMech = await aDefect("Coin mech jammed", "2026-09-02T08:00:00Z");
    await run(
      executeCommand(
        resolveDefectCommand,
        { defectId: coinMech, version: 0, closingNote: "Coin path cleaned" },
        as(eva, "2026-09-03T10:00:00Z"),
      ),
    );
    await run(
      executeCommand(
        retireMachineCommand,
        { machineId: lg042, version: 0, reason: "Sold to a collector" },
        as(eva, "2026-09-10T11:00:00Z"),
      ),
    );

    const html = await page("2026");

    const entryOf = (title: string) => {
      const start = html.indexOf(`>${title}<`);
      return html.slice(start, html.indexOf("</article>", start));
    };
    expect(entryOf("Display dead")).toContain("Geschlossen (ausgemustert) am 10.09.2026, 13:00");
    expect(entryOf("Display dead")).not.toContain("Abschlussnotiz");
    expect(entryOf("Display dead")).not.toContain("Offen");
    expect(entryOf("Coin mech jammed")).toContain("Coin path cleaned");
    expect(entryOf("Coin mech jammed")).not.toContain("ausgemustert");
  });
});

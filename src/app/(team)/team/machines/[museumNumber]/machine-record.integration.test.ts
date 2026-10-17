import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { changeMachineStatusCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { retireMachineForTest, withoutMachines } from "@/modules/collection/machines.test-support";
import {
  claimDefectCommand,
  putDefectOnHoldCommand,
  recordDefectCommand,
  reportProblemCommand,
  resolveDefectCommand,
  resolveProblemOnTheSpotCommand,
  type Priority,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";

/**
 * The machine record (RM-MachineRecord, ST-009): the page's data – the Collection module's record with the names of
 * the Team module's team members (ST-009: modules are composed by the page) – rendered by its view. In a database of
 * its own, because a test can only arrange "LG-042" where no other test registers machines.
 */
const isolated = isolatedTestDatabase("machine_record");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, tom, "Tom");
  const created = await executeCommand(
    createMachineModelCommand,
    {
      title: "Medieval Madness",
      manufacturer: "Williams",
      year: "1997",
      machineCategory: "pinball",
      technology: "dmd",
    },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(museumNumber: string, at: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: "MM-12345",
      location: "Hall 2, row 3",
      machineStatus: "playable",
    },
    { actor: eva, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

const NOW = "2026-10-14T10:00:00Z";

async function page(museumNumber: string): Promise<string> {
  const record = await loadMachineRecord(db, museumNumber, { clock: fixedClock(NOW) });
  return renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber }));
}

/** The part of the page from the given section's heading to the next section's. */
function section(html: string, heading: string): string {
  const start = html.indexOf(`>${heading}<`);
  if (start < 0) return "";
  const next = html.indexOf("<section", start);
  return html.slice(start, next < 0 ? undefined : next);
}

/** A problem report a visitor sends for the machine – untriaged, at version 0. */
async function reported(machineId: string, description: string, at: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

/** An open defect of the machine, recorded by Eva through triage – at version 0. */
async function anOpenDefect(machineId: string, title: string, priority: Priority, at = "2026-10-10T09:00:00Z") {
  const recorded = await executeCommand(
    recordDefectCommand,
    {
      problemReportId: await reported(machineId, `${title} – reported`, at),
      version: 0,
      title,
      priority,
      suitableForHelpers: false,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: eva, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!recorded.ok) throw new Error(recorded.error);
  return recorded.result.defectId;
}

describe("the machine record", () => {
  it("ST-009: Machine status history is shown newest first", async () => {
    const machineId = await registered("LG-042", "2026-01-15T09:00:00Z");
    const changed = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "out-of-order", reason: "flipper coil burnt" },
      { actor: tom, db, clock: fixedClock("2026-01-20T13:30:00Z"), newId: randomUUID },
    );
    if (!changed.ok) throw new Error("not changed");

    const html = await page("LG-042");

    const change = html.indexOf("Spielbereit → Außer Betrieb");
    const registration = html.indexOf("Erfasst als Spielbereit");
    expect(change).toBeGreaterThan(-1);
    expect(registration).toBeGreaterThan(change);
    expect(html).toContain("flipper coil burnt · Tom · 20.01.2026, 14:30");
    expect(html).toContain("Eva · 15.01.2026, 10:00");
  });

  it("ST-009: Unknown museum number", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");

    expect(await loadMachineRecord(db, "LG-999")).toBeUndefined();
    expect(await page("LG-999")).toContain("Kein Gerät mit der Museumsnummer LG-999.");
  });

  it("ST-009: Retired machine keeps its record", async () => {
    const machineId = await registered("LG-013", "2026-01-15T09:00:00Z");
    const retired = await executeCommand(
      retireMachineForTest,
      { machineId, version: 0 },
      { actor: tom, db, clock: fixedClock("2026-03-01T11:00:00Z"), newId: randomUUID },
    );
    if (!retired.ok) throw new Error("not retired");

    const html = await page("LG-013");

    expect(html).toContain("Ausgemustert am 01.03.2026, 12:00 von Tom – Sold");
    expect(html).toContain("MM-12345");
    expect(html).toContain("Hall 2, row 3");
    expect(html).toContain("Erfasst als Spielbereit");
  });

  it("shows the machine model's details next to the machine's own", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");

    const html = await page("LG-042");

    for (const [term, value] of [
      ["Seriennummer", "MM-12345"],
      ["Modell", "Medieval Madness"],
      ["Hersteller", "Williams"],
      ["Baujahr", "1997"],
      ["Kategorie", "Flipper"],
      ["Technik", "DMD"],
      ["Standort", "Hall 2, row 3"],
      ["Status", "Spielbereit"],
    ]) {
      expect(html).toContain(`<dt class="text-muted-foreground">${term}</dt><dd>${value}</dd>`);
    }
  });

  it("offers „Problem melden“ for an active machine and not for a retired one (ST-015, G11)", async () => {
    await registered("LG-042", "2026-01-15T09:00:00Z");
    const retiredId = await registered("LG-013", "2026-01-15T09:00:00Z");
    const retired = await executeCommand(
      retireMachineForTest,
      { machineId: retiredId, version: 0 },
      { actor: tom, db, clock: fixedClock("2026-03-01T11:00:00Z"), newId: randomUUID },
    );
    if (!retired.ok) throw new Error("not retired");

    expect(await page("LG-042")).toContain('href="/team/machines/LG-042/melden"');
    expect(await page("LG-013")).not.toContain("/melden");
  });

  describe("its open defects and its repair history (ST-033)", () => {
    it("ST-033: Machine record shows open defects", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      const flipper = await anOpenDefect(lg042, "Left flipper weak", "high");
      const rubber = await anOpenDefect(lg042, "Rubber cracked", "low");
      const claimed = await executeCommand(
        claimDefectCommand,
        { defectId: flipper, version: 0 },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!claimed.ok) throw new Error(claimed.error);

      const openDefects = section(await page("LG-042"), "Offene Defekte");

      // The same facts and words as the open defects list – high priority first.
      const entryOf = (title: string) => openDefects.slice(openDefects.indexOf(title)).split("</article>")[0];
      expect(openDefects.indexOf("Left flipper weak")).toBeLessThan(openDefects.indexOf("Rubber cracked"));
      expect(entryOf("Left flipper weak")).toContain("Priorität: hoch");
      expect(entryOf("Left flipper weak")).toContain("Übernommen von Tom");
      expect(entryOf("Rubber cracked")).toContain("Priorität: niedrig");
      expect(entryOf("Rubber cracked")).not.toContain("bernommen");
      expect(openDefects).toMatch(new RegExp(`<a [^>]*href="/team/defects/${flipper}"[^>]*>Left flipper weak</a>`));
      expect(openDefects).toMatch(new RegExp(`<a [^>]*href="/team/defects/${rubber}"[^>]*>Rubber cracked</a>`));
    });

    it("ST-029: Machine record shows the on-hold reason of an open defect", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      const rubber = await anOpenDefect(lg042, "Rubber cracked", "normal");
      const held = await executeCommand(
        putDefectOnHoldCommand,
        { defectId: rubber, version: 0, reason: "waiting-for-part" },
        { actor: eva, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!held.ok) throw new Error(held.error);

      const openDefects = section(await page("LG-042"), "Offene Defekte");

      expect(openDefects.slice(openDefects.indexOf("Rubber cracked")).split("</article>")[0]).toContain(
        "Pausiert – Wartet auf Ersatzteil",
      );
    });

    it("ST-033: A machine without open defects says so", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      // A resolved defect is not open.
      const resolved = await executeCommand(
        resolveDefectCommand,
        { defectId: await anOpenDefect(lg042, "Coin door jammed", "normal"), version: 0, closingNote: "Lock replaced" },
        { actor: eva, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!resolved.ok) throw new Error(resolved.error);

      expect(section(await page("LG-042"), "Offene Defekte")).toContain("Keine offenen Defekte.");
    });

    it("ST-033: A machine with no repair history", async () => {
      await registered("LG-042", "2026-01-15T09:00:00Z");

      const repairs = section(await page("LG-042"), "Reparaturhistorie");

      expect(repairs).toContain("An diesem Gerät wurde noch nichts repariert.");
      expect(repairs).not.toContain("Ganze Reparaturhistorie");
    });

    it("shows the 3 most recent repairs, the most recently ended first, and leads to the whole repair history", async () => {
      const lg042 = await registered("LG-042", "2026-01-15T09:00:00Z");
      const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
      for (const [index, day] of days.entries()) {
        const resolved = await executeCommand(
          resolveDefectCommand,
          {
            defectId: await anOpenDefect(lg042, `Defect ${index + 1}`, "normal", `${day}T08:00:00Z`),
            version: 0,
            closingNote: `Closing note ${index + 1}`,
          },
          { actor: eva, db, clock: fixedClock(`${day}T12:00:00Z`), newId: randomUUID },
        );
        if (!resolved.ok) throw new Error(resolved.error);
      }
      const ball = await reported(lg042, "Ball stuck", "2026-10-05T08:00:00Z");
      const freed = await executeCommand(
        resolveProblemOnTheSpotCommand,
        { problemReportId: ball, version: 0, note: "Ball freed" },
        { actor: tom, db, clock: fixedClock("2026-10-05T08:10:00Z"), newId: randomUUID },
      );
      if (!freed.ok) throw new Error(freed.error);
      // Open defects are part of the repair history, but shown in their own section.
      await anOpenDefect(lg042, "Left flipper weak", "high", "2026-10-06T08:00:00Z");

      const repairs = section(await page("LG-042"), "Reparaturhistorie");

      expect(repairs).toContain("Ball freed");
      expect(repairs).toContain("Tom · 05.10.2026, 10:10");
      expect(repairs.indexOf("Ball freed")).toBeLessThan(repairs.indexOf("Defect 4"));
      expect(repairs.indexOf("Defect 4")).toBeLessThan(repairs.indexOf("Defect 3"));
      expect(repairs).toContain("Closing note 3");
      expect(repairs).not.toContain("Defect 2");
      expect(repairs).not.toContain("Left flipper weak");
      expect(repairs).toMatch(
        /<a [^>]*href="\/team\/machines\/LG-042\/reparaturhistorie"[^>]*>Ganze Reparaturhistorie \(6\)<\/a>/,
      );
    });
  });
});

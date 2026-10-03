import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { changeMachineStatusCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import {
  retireMachineForTest,
  withoutMachines,
} from "@/modules/collection/machines.test-support";
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
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball", technology: "dmd" },
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

async function page(museumNumber: string): Promise<string> {
  return renderToStaticMarkup(createElement(MachineRecordView, { record: await loadMachineRecord(db, museumNumber), museumNumber }));
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
});

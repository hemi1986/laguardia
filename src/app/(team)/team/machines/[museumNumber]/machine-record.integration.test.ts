import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { changeMachineStatusForTest, withoutMachines } from "@/modules/collection/machines.test-support";
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
      changeMachineStatusForTest,
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
});

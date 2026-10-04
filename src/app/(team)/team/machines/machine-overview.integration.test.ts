import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { recordDefectCommand, reportProblemCommand } from "@/modules/repair";
import { resolveDefectForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineOverview } from "./machine-overview-data";
import { MachineOverview } from "./machine-overview";

/**
 * The machine overview's data – Collection's machines with Repair's number of open defects per machine (the page
 * composes, ST-009) – rendered by its view. In a database of its own, so "LG-042" can be arranged.
 */
const isolated = isolatedTestDatabase("machine_overview_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const clock = fixedClock("2026-10-04T10:00:00Z");
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(museumNumber: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    { actor: tom, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function anOpenDefect(machineId: string, title: string) {
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description: title },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  const recorded = await executeCommand(
    recordDefectCommand,
    {
      problemReportId: reported.result.problemReportId,
      version: 0,
      title,
      priority: undefined,
      suitableForHelpers: false,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!recorded.ok) throw new Error(recorded.error);
  return recorded.result.defectId;
}

describe("the machine overview with open defects", () => {
  it("ST-021: Machine overview shows the number of open defects", async () => {
    const lg042 = await registered("LG-042");
    await registered("LG-007");
    await anOpenDefect(lg042, "Left flipper weak");
    await anOpenDefect(lg042, "Display flickers");
    const coinDoor = await anOpenDefect(lg042, "Coin door jammed");
    const resolved = await executeCommand(
      resolveDefectForTest,
      { defectId: coinDoor, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);

    const data = await loadMachineOverview(db, {});

    expect(data.machines.map((machine) => [machine.museumNumber, machine.openDefects])).toEqual([
      ["LG-007", 0],
      ["LG-042", 2],
    ]);
    const html = renderToStaticMarkup(createElement(MachineOverview, { ...data, query: {}, canRegister: false }));
    const lg007At = html.indexOf("LG-007 · Medieval Madness");
    const lg042At = html.indexOf("LG-042 · Medieval Madness");
    expect(html.slice(lg042At)).toContain("2 offene Defekte");
    expect(html.slice(lg007At, lg042At)).not.toContain("offene"); // a zero is not shown (ST-008)
  });
});

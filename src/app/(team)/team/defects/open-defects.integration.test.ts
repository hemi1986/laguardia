import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { recordDefectCommand, reportProblemCommand, type Priority } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadOpenDefects, type OpenDefectsFilter } from "./open-defects-data";
import { OpenDefectsView } from "./open-defects";

/**
 * The open defects list (RM-OpenDefects, ST-021): the page's data – Repair's open defects with Collection's museum
 * numbers and titles (the page composes, ST-009) – rendered by its view. In a database of its own, so "LG-042" and
 * "7 defects are open" can be arranged.
 */
const isolated = isolatedTestDatabase("open_defects");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = "2026-10-04T10:00:00Z";
let medievalMadness: string;
let attackFromMars: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  medievalMadness = await machineModel("Medieval Madness");
  attackFromMars = await machineModel("Attack from Mars");
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function machineModel(title: string) {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function registered(museumNumber: string, machineModelId = medievalMadness) {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

const daysBefore = (days: number) => new Date(new Date(NOW).getTime() - days * 86_400_000).toISOString();

/** A defect recorded through triage (CMD-RecordDefect) at the given time – the only way a defect comes to be. */
async function anOpenDefect(
  machineId: string,
  title: string,
  {
    priority = "normal",
    suitableForHelpers = false,
    at = daysBefore(1),
  }: Partial<{
    priority: Priority;
    suitableForHelpers: boolean;
    at: string;
  }> = {},
) {
  const clock = fixedClock(at);
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description: `${title} – reported` },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  const recorded = await executeCommand(
    recordDefectCommand,
    {
      problemReportId: reported.result.problemReportId,
      version: 0,
      title,
      priority,
      suitableForHelpers,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!recorded.ok) throw new Error(recorded.error);
  return recorded.result.defectId;
}

async function page(filter: OpenDefectsFilter = {}): Promise<string> {
  return renderToStaticMarkup(
    createElement(OpenDefectsView, { data: await loadOpenDefects(db, fixedClock(NOW), filter) }),
  );
}

describe("the open defects list", () => {
  it("ST-021: Team member sees all open defects", async () => {
    const lg042 = await registered("LG-042");
    const lg007 = await registered("LG-007", attackFromMars);
    await anOpenDefect(lg007, "Display flickers", { at: daysBefore(8) });
    await anOpenDefect(lg042, "Left flipper weak", { priority: "high", suitableForHelpers: true, at: daysBefore(5) });

    const { entries } = await loadOpenDefects(db, fixedClock(NOW), {});

    expect(
      entries.map(({ museumNumber, machineModelTitle, title, priority, suitableForHelpers, openSince }) => ({
        museumNumber,
        machineModelTitle,
        title,
        priority,
        suitableForHelpers,
        openSince,
      })),
    ).toEqual([
      {
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness",
        title: "Left flipper weak",
        priority: "high",
        suitableForHelpers: true,
        openSince: new Date(daysBefore(5)),
      },
      {
        museumNumber: "LG-007",
        machineModelTitle: "Attack from Mars",
        title: "Display flickers",
        priority: "normal",
        suitableForHelpers: false,
        openSince: new Date(daysBefore(8)),
      },
    ]);
    const html = await page();
    expect(html).toContain("LG-042 · Medieval Madness");
    expect(html).toContain("Left flipper weak");
    expect(html).toContain("Priorität: hoch");
    expect(html).toContain("Für Helfer:innen geeignet");
    expect(html).toContain("29.09.2026, 12:00 · offen seit 5 Tagen");
    expect(html).toContain("LG-007 · Attack from Mars");
    expect(html).toContain("Priorität: normal");
    expect(html.indexOf("Left flipper weak")).toBeLessThan(html.indexOf("Display flickers"));
  });
});

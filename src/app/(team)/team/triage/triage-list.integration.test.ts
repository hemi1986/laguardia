import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { reportProblemCommand } from "@/modules/repair";
import { triageForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadTriageList } from "./triage-list-data";
import { TriageListView } from "./triage-list";

/**
 * The triage list (RM-TriageList, ST-017): the page's data – Repair's untriaged problem reports with Collection's
 * museum numbers and titles and Team's names (the page composes, ST-009) – rendered by its view. In a database of its
 * own, so "LG-042" and "12 problem reports wait" can be arranged.
 */
const isolated = isolatedTestDatabase("triage_list");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const visitor: Actor = { kind: "visitor" };
const NOW = "2026-10-03T16:00:00Z";
let medievalMadness: string;
let attackFromMars: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
  medievalMadness = await machineModel("Medieval Madness");
  attackFromMars = await machineModel("Attack from Mars");
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function machineModel(title: string) {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function registered(museumNumber: string, machineModelId = medievalMadness) {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function reported(machineId: string, description: string, at: string, actor: Actor = visitor) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

const hoursBefore = (hours: number) => new Date(new Date(NOW).getTime() - hours * 3_600_000).toISOString();

async function page(): Promise<string> {
  return renderToStaticMarkup(createElement(TriageListView, { data: await loadTriageList(db, fixedClock(NOW)) }));
}

describe("the triage list", () => {
  it("ST-017: Technician sees untriaged problem reports", async () => {
    const lg042 = await registered("LG-042");
    const lg007 = await registered("LG-007", attackFromMars);
    await reported(lg007, "Rubber cracked", "2026-10-03T13:10:00Z", anna);
    await reported(lg042, "Ball stuck behind the left ramp", "2026-10-03T12:05:00Z");

    const data = await loadTriageList(db, fixedClock(NOW));

    expect(
      data.entries.map(({ museumNumber, machineModelTitle, description, reporter, reportedAt }) => ({
        museumNumber,
        machineModelTitle,
        description,
        reporter,
        reportedAt,
      })),
    ).toEqual([
      {
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness",
        description: "Ball stuck behind the left ramp",
        reporter: { kind: "visitor" },
        reportedAt: new Date("2026-10-03T12:05:00Z"),
      },
      {
        museumNumber: "LG-007",
        machineModelTitle: "Attack from Mars",
        description: "Rubber cracked",
        reporter: { kind: "team-member", name: "Anna" },
        reportedAt: new Date("2026-10-03T13:10:00Z"),
      },
    ]);
    const html = await page();
    expect(html).toContain("LG-042 · Medieval Madness");
    expect(html).toContain("Besucher:in · 03.10.2026, 14:05");
    expect(html).toContain("Anna · 03.10.2026, 15:10");
    expect(html.indexOf("LG-042")).toBeLessThan(html.indexOf("LG-007"));
  });
});

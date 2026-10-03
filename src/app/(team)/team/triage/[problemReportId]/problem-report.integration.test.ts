import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadProblemReport } from "./problem-report-data";
import { ProblemReportView } from "./problem-report";

/**
 * A problem report's own page (ST-017) – where it is triaged; ST-017 owns it, the triage stories add their outcomes
 * (ST-018 ff.). Its data composes Repair, Collection and Team like the triage list. In a database of its own.
 */
const isolated = isolatedTestDatabase("problem_report_page");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const NOW = "2026-10-03T16:00:00Z";
let machineModelId: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  machineModelId = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function page(problemReportId: string) {
  const data = await loadProblemReport(db, fixedClock(NOW), problemReportId);
  return renderToStaticMarkup(createElement(ProblemReportView, { data }));
}

describe("a problem report's own page", () => {
  it("ST-017: Triaging happens on the problem report's own page", async () => {
    const machine = await executeCommand(
      registerMachineCommand,
      { machineModelId, museumNumber: "LG-042", serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
      { actor: eva, db, newId: randomUUID },
    );
    if (!machine.ok) throw new Error(machine.error);
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId: machine.result.machineId, description: "Rubber on the left slingshot cracked" },
      { actor: anna, db, clock: fixedClock("2026-10-03T11:00:00Z"), newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);

    const html = await page(reported.result.problemReportId);

    expect(html).toContain("LG-042 · Medieval Madness");
    expect(html).toContain("Rubber on the left slingshot cracked");
    expect(html).toContain("Anna");
    expect(html).toContain("03.10.2026, 13:00");
    expect(html).toContain("wartet seit 5 Stunden");
  });

  it("says so for an unknown problem report, also for an address that is no ID", async () => {
    for (const id of [randomUUID(), "not-an-id"]) {
      expect(await page(id)).toContain("Diese Meldung gibt es nicht.");
    }
  });
});

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { claimDefectCommand, reportProblemAndTriageCommand } from "@/modules/repair";
import { recordVisit } from "@/modules/team";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { hoursBefore } from "@/platform/time";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { HelperDashboard } from "./helper-dashboard";
import { loadHelperDashboard } from "./helper-dashboard-data";

/**
 * What the helper dashboard marks as new since the Last visit (ST-050, ADR 0011) – the visits recorded through the
 * Team area, the marks computed when the dashboard is opened. In a database of its own, so its sections can be arranged.
 */
const isolated = isolatedTestDatabase("helper_dashboard_new");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
type Helper = { kind: "team-member"; teamMemberId: string; role: "helper" };
let machineModelId: string;
const NOW = new Date("2026-06-10T10:00:00Z");
const daysAgo = (days: number) => hoursBefore(NOW, days * 24);

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const model = await run(
    executeCommand(
      createMachineModelCommand,
      { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
      { actor: tom, db, newId: randomUUID },
    ),
  );
  machineModelId = model.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  await withoutMaintenanceTasks(db);
});

async function run<Result>(outcome: Promise<{ ok: true; result: Result } | { ok: false; error: string }>) {
  const done = await outcome;
  if (!done.ok) throw new Error(done.error);
  return done.result;
}

async function aHelper(name: string): Promise<Helper> {
  const helper = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
  await anExistingTeamMember(db, helper, name);
  return helper;
}

/** An open defect suitable for helpers, recorded by Tom at that time on a machine of its own – and its claims. */
async function aDefect(title: string, recordedAt: Date) {
  const at = { actor: tom, db, clock: fixedClock(recordedAt), newId: randomUUID };
  const { machineId } = await run(
    executeCommand(
      registerMachineCommand,
      {
        machineModelId,
        museumNumber: undefined,
        serialNumber: undefined,
        location: "Hall 1",
        machineStatus: "playable",
      },
      at,
    ),
  );
  const { defectId } = await run(
    executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId,
        description: `${title} – first seen`,
        triage: {
          outcome: "defect-recorded",
          title,
          priority: undefined,
          suitableForHelpers: true,
          machineStatus: undefined,
          machineVersion: undefined,
        },
      },
      at,
    ),
  );
  let version = 0;
  return {
    claim: async (by: Helper, when: Date) => {
      await run(
        executeCommand(
          claimDefectCommand,
          { defectId: defectId!, version },
          { actor: by, db, clock: fixedClock(when), newId: randomUUID },
        ),
      );
      version += 1;
    },
  };
}

/**
 * The helper opens their dashboard at that time and sees what it shows: the page renders first, then its client effect
 * records the visit (ADR 0011).
 */
async function opensTheirDashboard(helper: Helper, at: Date) {
  const data = await loadHelperDashboard(db, fixedClock(at), { id: helper.teamMemberId, role: "helper" });
  await recordVisit(db, fixedClock(at), helper.teamMemberId);
  return { data, html: renderToStaticMarkup(createElement(HelperDashboard, { data })) };
}

describe("new since the Last visit on the helper dashboard", () => {
  it("ST-050: Staying logged in does not hide changes", async () => {
    // Logged in on her phone for 30 days – the session plays no part: the Last visit is what counts.
    const anna = await aHelper("Anna");
    const ben = await aHelper("Ben");
    const rubber = await aDefect("Rubber cracked", daysAgo(10));
    await rubber.claim(anna, daysAgo(5));
    await opensTheirDashboard(anna, daysAgo(3));
    await rubber.claim(ben, daysAgo(2));

    const { data, html } = await opensTheirDashboard(anna, NOW);

    expect(data.claimedByYou).toMatchObject([
      { title: "Rubber cracked", changes: [{ kind: "taken-over", by: "Ben", newSinceLastVisit: true }] },
    ]);
    expect(html).toContain("Ben hat übernommen · vor 2 Tagen · <strong");
  });

  it("marks a defect suitable for helpers recorded since the Last visit (user, 2026-10-24)", async () => {
    const anna = await aHelper("Anna");
    await aDefect("Rubber cracked", daysAgo(4));
    await opensTheirDashboard(anna, daysAgo(3));
    await aDefect("Ball stuck in the shooter lane", daysAgo(1));

    const { data, html } = await opensTheirDashboard(anna, NOW);

    expect(data.suitableForHelpers.map(({ title, newSinceLastVisit }) => ({ title, newSinceLastVisit }))).toEqual([
      { title: "Rubber cracked", newSinceLastVisit: false },
      { title: "Ball stuck in the shooter lane", newSinceLastVisit: true },
    ]);
    expect(html.match(/neu seit deinem letzten Besuch/g)).toHaveLength(1);
  });

  it("ST-050: Nothing is marked on the first visit", async () => {
    const ben = await aHelper("Ben");
    await aDefect("Rubber cracked", daysAgo(4));
    await aDefect("Ball stuck in the shooter lane", daysAgo(1));

    const { data, html } = await opensTheirDashboard(ben, NOW);

    expect(data.suitableForHelpers.map(({ title, newSinceLastVisit }) => ({ title, newSinceLastVisit }))).toEqual([
      { title: "Rubber cracked", newSinceLastVisit: false },
      { title: "Ball stuck in the shooter lane", newSinceLastVisit: false },
    ]);
    expect(html).toContain("Ball stuck in the shooter lane");
    expect(html).not.toContain("neu seit deinem letzten Besuch");
  });
});

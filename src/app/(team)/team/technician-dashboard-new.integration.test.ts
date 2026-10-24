import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { changeMachineStatusCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { recordDefectCommand, reportProblemCommand, resolveDefectCommand } from "@/modules/repair";
import { recordVisit } from "@/modules/team";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadTechnicianDashboard } from "./technician-dashboard-data";
import { TechnicianDashboard } from "./technician-dashboard";

/**
 * What the technician dashboard marks as new since the Last visit (ST-050, ADR 0011) – the visits recorded through the
 * Team area, the marks computed when the dashboard is opened. In a database of its own, so counts can be arranged.
 */
const isolated = isolatedTestDatabase("technician_dashboard_new");
let db: NodePgDatabase;
let tom: { kind: "team-member"; teamMemberId: string; role: "technician" };
let machineModelId: string;

beforeAll(async () => {
  db = await isolated.reset();
  const model = await run(
    executeCommand(
      createMachineModelCommand,
      { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
      {
        actor: { kind: "team-member", teamMemberId: await aTechnician("Setup"), role: "technician" },
        db,
        newId: randomUUID,
      },
    ),
  );
  machineModelId = model.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  // A Tom of his own per test – the Last visit is kept per team member.
  tom = { kind: "team-member", teamMemberId: await aTechnician("Tom"), role: "technician" };
});

async function run<Result>(outcome: Promise<{ ok: true; result: Result } | { ok: false; error: string }>) {
  const done = await outcome;
  if (!done.ok) throw new Error(done.error);
  return done.result;
}

async function aTechnician(name: string) {
  const teamMemberId = randomUUID();
  await anExistingTeamMember(db, { kind: "team-member", teamMemberId, role: "technician" }, name);
  return teamMemberId;
}

const as = (at: string) => ({ actor: tom, db, clock: fixedClock(at), newId: randomUUID });

async function aMachine(museumNumber: string) {
  const registered = await run(
    executeCommand(
      registerMachineCommand,
      { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
      as("2026-01-01T09:00:00Z"),
    ),
  );
  return registered.machineId;
}

/** A visitor's problem report, waiting for triage since that time. */
async function aProblemReport(machineId: string, at: string) {
  const reported = await run(
    executeCommand(
      reportProblemCommand,
      { machineId, description: "Something is wrong" },
      { ...as(at), actor: { kind: "visitor" } },
    ),
  );
  return reported.problemReportId;
}

/** An open defect recorded by Tom at that time from a visitor's problem report – at version 0. */
async function anOpenDefect(machineId: string, title: string, at: string) {
  const problemReportId = await aProblemReport(machineId, at);
  const recorded = await run(
    executeCommand(
      recordDefectCommand,
      {
        problemReportId,
        version: 0,
        title,
        priority: "normal",
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      as(at),
    ),
  );
  return recorded.defectId!;
}

/** Tom's dashboard rendered at that time – a prefetch or the re-render after an action, which records no visit. */
async function tomsDashboard(at: string) {
  const data = await loadTechnicianDashboard(db, fixedClock(at), { id: tom.teamMemberId, role: "technician" });
  return { data, html: renderToStaticMarkup(createElement(TechnicianDashboard, { data })) };
}

/**
 * Tom opens his dashboard at that time, on whichever device, and sees what it shows: the page renders first, then its
 * client effect records the visit (ADR 0011).
 */
async function tomOpensHisDashboard(at: string) {
  const shown = await tomsDashboard(at);
  await recordVisit(db, fixedClock(at), tom.teamMemberId);
  return shown;
}

describe("new since the Last visit on the technician dashboard", () => {
  it("ST-050: The triage section says how many waiting problem reports are new", async () => {
    await tomOpensHisDashboard("2026-06-09T18:00:00Z");
    const lg042 = await aMachine("LG-042");
    const lg043 = await aMachine("LG-043");
    await aProblemReport(lg043, "2026-06-08T09:00:00Z");
    await aProblemReport(lg043, "2026-06-09T17:00:00Z");
    await aProblemReport(lg042, "2026-06-10T10:00:00Z");

    const { data, html } = await tomOpensHisDashboard("2026-06-10T12:00:00Z");

    expect(data.problemReports).toEqual({ untriaged: 3, waitingLong: 0, newSinceLastVisit: 1 });
    expect(html).toContain("1 davon neu seit deinem letzten Besuch.");
  });

  /** Tom last opened his dashboard yesterday at 18:00, then today at 12:00 – when the report for "LG-042" was new. */
  async function theReportForLg042WasCountedAsNewAtNoon() {
    await tomOpensHisDashboard("2026-06-09T18:00:00Z");
    await aProblemReport(await aMachine("LG-042"), "2026-06-10T10:00:00Z");
    expect((await tomOpensHisDashboard("2026-06-10T12:00:00Z")).data.problemReports.newSinceLastVisit).toBe(1);
  }

  it("ST-050: The mark disappears after the visit", async () => {
    await theReportForLg042WasCountedAsNewAtNoon();

    const { data, html } = await tomOpensHisDashboard("2026-06-10T13:30:00Z");

    expect(data.problemReports.newSinceLastVisit).toBe(0);
    expect(html).not.toContain("neu seit deinem letzten Besuch");
  });

  it("ST-050: Coming back within the hour keeps the marks", async () => {
    await theReportForLg042WasCountedAsNewAtNoon();

    // He opens the problem report – nothing records a visit there – and comes back to his dashboard.
    const { data, html } = await tomOpensHisDashboard("2026-06-10T12:20:00Z");

    expect(data.problemReports.newSinceLastVisit).toBe(1);
    expect(html).toContain("Neu seit deinem letzten Besuch.");
  });

  it("ST-050: The last visit is shared across phone and workshop PC", async () => {
    await tomOpensHisDashboard("2026-06-09T18:00:00Z");
    await aProblemReport(await aMachine("LG-042"), "2026-06-10T11:00:00Z");
    // On the workshop PC – the Last visit is one value per team member, whatever device opens the dashboard.
    await tomOpensHisDashboard("2026-06-10T12:00:00Z");

    // On his phone.
    const { data } = await tomOpensHisDashboard("2026-06-10T13:30:00Z");

    expect(data.problemReports).toMatchObject({ untriaged: 1, newSinceLastVisit: 0 });
  });

  it("ST-050: Own actions are not marked", async () => {
    const ben = { kind: "team-member", teamMemberId: await aTechnician("Ben"), role: "technician" } as const;
    await tomOpensHisDashboard("2026-06-09T18:00:00Z");
    const lg042 = await aMachine("LG-042");
    const defectId = await anOpenDefect(lg042, "Left flipper weak", "2026-06-09T09:00:00Z");
    await run(
      executeCommand(
        resolveDefectCommand,
        { defectId, version: 0, closingNote: "Coil replaced" },
        as("2026-06-10T09:00:00Z"),
      ),
    );
    // Someone else's change in the same section is marked.
    await run(
      executeCommand(
        changeMachineStatusCommand,
        { machineId: await aMachine("LG-043"), version: 0, machineStatus: "limited", reason: "Slow ball" },
        { ...as("2026-06-10T09:30:00Z"), actor: ben },
      ),
    );

    const { data, html } = await tomOpensHisDashboard("2026-06-10T12:00:00Z");

    expect(data.recentChanges.map(({ kind, by, newSinceLastVisit }) => ({ kind, by, newSinceLastVisit }))).toEqual([
      { kind: "status-change", by: "Ben", newSinceLastVisit: true },
      { kind: "resolved", by: "Tom", newSinceLastVisit: false },
    ]);
    expect(html).toContain("Left flipper weak");
    expect(html.match(/neu seit deinem letzten Besuch/g)).toHaveLength(1);
  });
});

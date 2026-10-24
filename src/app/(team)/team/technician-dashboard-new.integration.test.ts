import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { reportProblemCommand } from "@/modules/repair";
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
  await run(
    executeCommand(
      reportProblemCommand,
      { machineId, description: "Something is wrong" },
      { ...as(at), actor: { kind: "visitor" } },
    ),
  );
}

/** Tom opens his dashboard at that time – on whichever device. */
const tomOpensHisDashboard = (at: string) => recordVisit(db, fixedClock(at), tom.teamMemberId);

async function tomsDashboard(at: string) {
  const data = await loadTechnicianDashboard(db, fixedClock(at), { id: tom.teamMemberId, role: "technician" });
  return { data, html: renderToStaticMarkup(createElement(TechnicianDashboard, { data })) };
}

describe("new since the Last visit on the technician dashboard", () => {
  it("ST-050: The triage section says how many waiting problem reports are new", async () => {
    await tomOpensHisDashboard("2026-06-09T18:00:00Z");
    const lg042 = await aMachine("LG-042");
    const lg043 = await aMachine("LG-043");
    await aProblemReport(lg043, "2026-06-08T09:00:00Z");
    await aProblemReport(lg043, "2026-06-09T17:00:00Z");
    await aProblemReport(lg042, "2026-06-10T10:00:00Z");

    await tomOpensHisDashboard("2026-06-10T12:00:00Z");
    const { data, html } = await tomsDashboard("2026-06-10T12:00:00Z");

    expect(data.problemReports).toEqual({ untriaged: 3, waitingLong: 0, newSinceLastVisit: 1 });
    expect(html).toContain("1 davon neu seit deinem letzten Besuch.");
  });
});

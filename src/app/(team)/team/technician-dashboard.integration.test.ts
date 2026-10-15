import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  changeMachineStatusCommand,
  createMachineModelCommand,
  registerMachineCommand,
  type MachineStatus,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { recordDefectCommand, reportProblemCommand, resolveDefectCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadTechnicianDashboard } from "./technician-dashboard-data";
import { TechnicianDashboard } from "./technician-dashboard";

/**
 * The technician dashboard (RM-TechnicianDashboard, ST-048): Repair's problem reports to triage and open defects,
 * Collection's machines that are not playable – the page composes (ST-009) –, computed when it is opened (ADR 0002).
 * In a database of its own, so "nothing needs attention" and exact counts can be arranged.
 */
const isolated = isolatedTestDatabase("technician_dashboard");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let machineModelId: string;
const NOW = "2026-06-10T10:00:00Z";

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

beforeEach(() => withoutMachines(db));

async function run<Result>(outcome: Promise<{ ok: true; result: Result } | { ok: false; error: string }>) {
  const done = await outcome;
  if (!done.ok) throw new Error(done.error);
  return done.result;
}

const as = (at: string) => ({ actor: tom, db, clock: fixedClock(at), newId: randomUUID });

async function aMachine(museumNumber: string, machineStatus: MachineStatus = "playable") {
  const registered = await run(
    executeCommand(
      registerMachineCommand,
      { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus },
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

/** An open defect recorded from a problem report – at version 0. */
async function anOpenDefect(machineId: string, title: string) {
  const recorded = await run(
    executeCommand(
      recordDefectCommand,
      {
        problemReportId: await aProblemReport(machineId, "2026-06-01T09:00:00Z"),
        version: 0,
        title,
        priority: "normal",
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      as("2026-06-01T10:00:00Z"),
    ),
  );
  return recorded.defectId!;
}

async function dashboard() {
  const data = await loadTechnicianDashboard(db, fixedClock(NOW));
  return { data, html: renderToStaticMarkup(createElement(TechnicianDashboard, { data })) };
}

describe("the technician dashboard", () => {
  it("ST-048: Untriaged problem reports with long waits highlighted", async () => {
    const lg042 = await aMachine("LG-042");
    // 73 hours before NOW, and two more recent ones.
    await aProblemReport(lg042, "2026-06-07T09:00:00Z");
    await aProblemReport(lg042, "2026-06-09T09:00:00Z");
    await aProblemReport(lg042, "2026-06-10T08:00:00Z");

    const { data, html } = await dashboard();

    expect(data.problemReports).toEqual({ untriaged: 3, waitingLong: 1 });
    expect(html).toContain("3 Meldungen warten auf die Sichtung – 1 davon länger als 3 Tage.");
  });

  it("ST-048: Machines without open defects that are not playable", async () => {
    const lg042 = await aMachine("LG-042", "out-of-order");
    const defectId = await anOpenDefect(lg042, "Coin door jammed");
    await run(executeCommand(resolveDefectCommand, { defectId, version: 0, closingNote: "Lock replaced" }, as(NOW)));

    const { data, html } = await dashboard();

    expect(data.machinesToReturnToPlay).toEqual([
      { museumNumber: "LG-042", machineModelTitle: "Medieval Madness", machineStatus: "out-of-order" },
    ]);
    expect(html).toContain("Außer Betrieb · kein offener Defekt");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042"[^>]*>LG-042<\/a>/);
  });

  it("ST-048: Machines with open defects are not listed", async () => {
    const lg043 = await aMachine("LG-043", "limited");
    await anOpenDefect(lg043, "Left flipper weak");
    // Playable machines are never listed, with or without defects.
    await aMachine("LG-044", "playable");

    const { data, html } = await dashboard();

    expect(data.machinesToReturnToPlay).toEqual([]);
    expect(html).not.toContain("LG-043");
    expect(html).not.toContain("LG-044");
  });

  it("ST-048: Technician returns a machine to play from the dashboard", async () => {
    const lg042 = await aMachine("LG-042", "out-of-order");
    expect((await dashboard()).data.machinesToReturnToPlay.map((machine) => machine.museumNumber)).toEqual(["LG-042"]);

    await run(
      executeCommand(
        changeMachineStatusCommand,
        { machineId: lg042, version: 0, machineStatus: "playable", reason: "Repaired and tested" },
        as(NOW),
      ),
    );

    expect((await dashboard()).data.machinesToReturnToPlay).toEqual([]);
  });

  it("ST-048: Nothing needs the technician right now", async () => {
    await aMachine("LG-042", "playable");

    const { html } = await dashboard();

    expect(html).toContain("Gerade braucht nichts deine Aufmerksamkeit.");
    expect(html).not.toContain("Sichtung");
  });

  it("ST-048: The dashboard leads to the triage list", async () => {
    const lg042 = await aMachine("LG-042");
    for (const at of ["2026-06-09T09:00:00Z", "2026-06-09T10:00:00Z", "2026-06-09T11:00:00Z"]) {
      await aProblemReport(lg042, at);
    }

    const { html } = await dashboard();

    expect(html).toContain("3 Meldungen warten auf die Sichtung.");
    expect(html).toMatch(/<a [^>]*href="\/team\/triage"[^>]*>Zur Sichtung<\/a>/);
    // The other section says it has nothing, in a sentence of its own.
    expect(html).toContain("Kein Gerät wartet auf die Rückkehr ins Spiel.");
  });

  it("offers the status change on each machine it lists, and says when no problem report waits", async () => {
    await aMachine("LG-042", "limited");

    const { html } = await dashboard();

    expect(html).toContain("Eingeschränkt · kein offener Defekt");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042\/status"[^>]*>Status ändern<\/a>/);
    expect(html).toContain("Keine Meldung wartet auf die Sichtung.");
  });
});

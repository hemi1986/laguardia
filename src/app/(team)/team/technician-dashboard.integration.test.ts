import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  changeMachineStatusCommand,
  createMachineModelCommand,
  machineOverview,
  registerMachineCommand,
  type MachineStatus,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { changeMaintenancePlanCommand, maintenancePlanVersion } from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import {
  claimDefectCommand,
  logWorkCommand,
  openDefects,
  putDefectOnHoldCommand,
  recordDefectCommand,
  reopenDefectCommand,
  reportProblemCommand,
  resolveDefectCommand,
} from "@/modules/repair";
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
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let machineModelId: string;
const NOW = "2026-06-10T10:00:00Z";

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, ben, "Ben");
  await anExistingTeamMember(db, anna, "Anna");
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

/** A maintenance task every 3 months from 2026-01-01 – due from 2026-04-01 and overdue at NOW on every machine. */
async function aMaintenanceTask(name: string) {
  await run(
    executeCommand(
      changeMaintenancePlanCommand,
      {
        version: await maintenancePlanVersion(db),
        change: "add",
        task: {
          name,
          instruction: `${name} – how to`,
          intervalMonths: 3,
          suitableForHelpers: false,
          machineCategory: undefined,
          technology: undefined,
          startDate: "2026-01-01",
        },
      },
      as("2025-12-01T09:00:00Z"),
    ),
  );
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

/** An open defect recorded from a problem report – at version 0; recorded on 2026-06-01 unless the day is given. */
async function anOpenDefect(machineId: string, title: string, day = "2026-06-01") {
  const recorded = await run(
    executeCommand(
      recordDefectCommand,
      {
        problemReportId: await aProblemReport(machineId, `${day}T09:00:00Z`),
        version: 0,
        title,
        priority: "normal",
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      as(`${day}T10:00:00Z`),
    ),
  );
  return recorded.defectId!;
}

/** That team member sets the machine – at that version – to that machine status at that time. */
async function statusChanged(
  machineId: string,
  version: number,
  machineStatus: MachineStatus,
  by: typeof tom | typeof anna,
  at: string,
) {
  await run(
    executeCommand(
      changeMachineStatusCommand,
      { machineId, version, machineStatus, reason: "Checked it" },
      { ...as(at), actor: by },
    ),
  );
}

/** The defect is claimed by that team member at that time – the defect at that version. */
async function claimed(defectId: string, version: number, by: typeof ben, at: string) {
  await run(executeCommand(claimDefectCommand, { defectId, version }, { ...as(at), actor: by }));
}

/** That team member logs work on the defect at that time – the defect at that version. */
async function workLogged(defectId: string, version: number, by: typeof tom, at: string) {
  await run(
    executeCommand(
      logWorkCommand,
      { defectId, version, whatWasDone: "Measured the voltages", partsUsed: "" },
      { ...as(at), actor: by },
    ),
  );
}

async function dashboard() {
  const data = await loadTechnicianDashboard(db, fixedClock(NOW), { id: tom.teamMemberId, role: "technician" });
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

    expect(data.problemReports).toEqual({ untriaged: 3, waitingLong: 1, newSinceLastVisit: 0 });
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

    expect((await machineOverview(db, { machineStatus: "playable" })).map((machine) => machine.museumNumber)).toEqual([
      "LG-042",
    ]);
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

  it("ST-058: Stale claims are singled out", async () => {
    const lg042 = await aMachine("LG-042");
    const defectId = await anOpenDefect(lg042, "Display flickers", "2026-05-20");
    // 15 days before NOW.
    await claimed(defectId, 0, ben, "2026-05-26T10:00:00Z");

    const { data, html } = await dashboard();

    expect(data.staleClaims).toEqual([
      {
        defectId,
        title: "Display flickers",
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness",
        claimant: "Ben",
      },
    ]);
    expect(html).toMatch(new RegExp(`<a [^>]*href="/team/defects/${defectId}"[^>]*>Display flickers</a>`));
    expect(html).toContain("Von Ben vor mehr als 14 Tagen übernommen, seitdem kein Arbeitsschritt.");
    // Only singled out, never released.
    expect((await openDefects(db, { claimedBy: ben.teamMemberId })).map((defect) => defect.id)).toEqual([defectId]);
  });

  it("ST-058: A work log entry by someone else keeps a claim from being stale", async () => {
    const lg042 = await aMachine("LG-042");
    const defectId = await anOpenDefect(lg042, "Display flickers", "2026-05-20");
    await claimed(defectId, 0, ben, "2026-05-26T10:00:00Z");
    await workLogged(defectId, 1, tom, "2026-06-07T10:00:00Z");

    const { data, html } = await dashboard();

    expect(data.staleClaims).toEqual([]);
    expect(html).not.toContain("Display flickers");
  });

  it("a claim becomes stale only after more than 14 days, and work logged before it was claimed does not count", async () => {
    const lg042 = await aMachine("LG-042");
    // Exactly 336 hours before NOW – not more.
    const justNotStale = await anOpenDefect(lg042, "Coil hot", "2026-05-20");
    await claimed(justNotStale, 0, ben, "2026-05-27T10:00:00Z");
    // Tom logged work, then Ben took it over: the claim is Ben's, made after the work log entry.
    const takenOver = await anOpenDefect(lg042, "Drop target sticks", "2026-05-20");
    await claimed(takenOver, 0, tom, "2026-05-21T10:00:00Z");
    await workLogged(takenOver, 1, tom, "2026-05-22T10:00:00Z");
    await claimed(takenOver, 2, ben, "2026-05-25T10:00:00Z");

    const { data } = await dashboard();

    expect(data.staleClaims.map((claim) => [claim.title, claim.claimant])).toEqual([["Drop target sticks", "Ben"]]);
  });

  it("a claim on a defect on hold is never stale – the defect waits on purpose", async () => {
    const lg042 = await aMachine("LG-042");
    const defectId = await anOpenDefect(lg042, "Display flickers", "2026-05-20");
    await claimed(defectId, 0, ben, "2026-05-26T10:00:00Z");
    await run(
      executeCommand(
        putDefectOnHoldCommand,
        { defectId, version: 1, reason: "waiting-for-part" },
        { ...as("2026-05-27T10:00:00Z"), actor: ben },
      ),
    );

    const { data } = await dashboard();

    expect(data.staleClaims).toEqual([]);
  });

  it("ST-058: Overdue maintenance tasks are counted, not listed by machine", async () => {
    await aMachine("LG-042");
    await aMachine("LG-043");
    await aMaintenanceTask("Wax playfield");

    const { data, html } = await dashboard();

    expect(data.overdueMaintenance.map(({ name, overdueCount }) => ({ name, overdueCount }))).toEqual([
      { name: "Wax playfield", overdueCount: 2 },
    ]);
    expect(html).toContain("„Wax playfield“ ist an 2 Geräten überfällig.");
    expect(html).not.toContain("LG-042");
    expect(html).toMatch(/<a [^>]*href="\/team\/maintenance"[^>]*>Zur Wartung<\/a>/);
  });

  it("ST-058: Machine status changes and resolved or reopened defects", async () => {
    const lg007 = await aMachine("LG-007");
    const defectId = await anOpenDefect(lg007, "Left flipper weak");
    // Yesterday.
    await statusChanged(lg007, 0, "out-of-order", anna, "2026-06-09T12:00:00Z");
    await run(
      executeCommand(
        resolveDefectCommand,
        { defectId, version: 0, closingNote: "Coil replaced" },
        as("2026-06-09T15:00:00Z"),
      ),
    );
    // Today.
    await run(
      executeCommand(reopenDefectCommand, { defectId, version: 1, reason: "Weak again" }, as("2026-06-10T09:00:00Z")),
    );

    const { data, html } = await dashboard();

    expect(data.recentChanges).toEqual([
      {
        kind: "reopened",
        defectId,
        title: "Left flipper weak",
        museumNumber: "LG-007",
        by: "Tom",
        at: new Date("2026-06-10T09:00:00Z"),
        newSinceLastVisit: false,
      },
      {
        kind: "resolved",
        defectId,
        title: "Left flipper weak",
        museumNumber: "LG-007",
        by: "Tom",
        at: new Date("2026-06-09T15:00:00Z"),
        newSinceLastVisit: false,
      },
      {
        kind: "status-change",
        museumNumber: "LG-007",
        previousStatus: "playable",
        newStatus: "out-of-order",
        by: "Anna",
        at: new Date("2026-06-09T12:00:00Z"),
        newSinceLastVisit: false,
      },
    ]);
    expect(html).toContain("Letzte Änderungen");
    expect(html).toContain("Spielbereit → Außer Betrieb · Anna · 09.06.2026, 14:00");
    expect(html).toContain("(LG-007) wieder geöffnet · Tom · 10.06.2026, 11:00");
    expect(html).toMatch(new RegExp(`<a [^>]*href="/team/defects/${defectId}"[^>]*>Left flipper weak</a>`));
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-007"[^>]*>LG-007<\/a>/);
  });

  it("ST-058: Older changes drop off after 7 days", async () => {
    const lg007 = await aMachine("LG-007");
    // 8 days before NOW. The last visit is recorded from ST-050 on – until then "since the last visit" is no
    // longer ago than 7 days, so only the 7-day window decides (user, 2026-10-24).
    await statusChanged(lg007, 0, "limited", tom, "2026-06-02T10:00:00Z");
    // Just inside the 7 days.
    await statusChanged(lg007, 1, "out-of-order", tom, "2026-06-03T10:00:01Z");

    const { data, html } = await dashboard();

    expect(data.recentChanges.map((change) => change.at)).toEqual([new Date("2026-06-03T10:00:01Z")]);
    expect(html).not.toContain("Spielbereit → Eingeschränkt");
  });

  it("ST-058: An empty section says so next to a filled one", async () => {
    await aMachine("LG-042");
    await aMaintenanceTask("Wax playfield");

    const { html } = await dashboard();

    expect(html).toContain("Kein Defekt ist liegengeblieben.");
    expect(html).toContain("„Wax playfield“ ist an 1 Gerät überfällig.");
    expect(html).not.toContain("Gerade braucht nichts deine Aufmerksamkeit.");
  });

  it("ST-058: Recent changes are shown below the all-empty sentence", async () => {
    const lg007 = await aMachine("LG-007", "limited");
    // Yesterday.
    await statusChanged(lg007, 0, "playable", tom, "2026-06-09T12:00:00Z");

    const { html } = await dashboard();

    const allEmpty = html.indexOf("Gerade braucht nichts deine Aufmerksamkeit.");
    const statusChange = html.indexOf("Eingeschränkt → Spielbereit · Tom · 09.06.2026, 14:00");
    expect(allEmpty).toBeGreaterThan(-1);
    expect(statusChange).toBeGreaterThan(allEmpty);
    expect(html).not.toContain("Liegengeblieben");
    expect(html).not.toContain("Überfällige Wartung");
  });

  it("says when nothing changed in the last 7 days next to sections that need attention", async () => {
    const lg042 = await aMachine("LG-042");
    await aProblemReport(lg042, "2026-06-09T09:00:00Z");

    const { html } = await dashboard();

    expect(html).toContain("Keine Änderungen in den letzten 7 Tagen.");
  });

  it("offers the status change on each machine it lists, and says when no problem report waits", async () => {
    await aMachine("LG-042", "limited");

    const { html } = await dashboard();

    expect(html).toContain("Eingeschränkt · kein offener Defekt");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042\/status"[^>]*>Status ändern<\/a>/);
    expect(html).toContain("Keine Meldung wartet auf die Sichtung.");
  });
});

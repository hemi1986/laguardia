import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { dismissProblemReportCommand, recordDefectCommand, reportProblemCommand } from "@/modules/repair";
import { triageForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
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

async function page(problemReportId: string, role: "helper" | "technician" = "technician") {
  const data = await loadProblemReport(db, fixedClock(NOW), problemReportId);
  return renderToStaticMarkup(createElement(ProblemReportView, { data, role }));
}

async function anUntriagedProblemReport(museumNumber = "LG-042", photo?: string) {
  const machine = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!machine.ok) throw new Error(machine.error);
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId: machine.result.machineId, description: "Left flipper barely moves", photo },
    { actor: anna, db, clock: fixedClock("2026-10-03T11:00:00Z"), newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  return reported.result.problemReportId;
}

const recordDefectLink = (id: string) => `href="/team/triage/${id}/defekt-erfassen"`;
const resolveOnTheSpotLink = (id: string) => `href="/team/triage/${id}/direkt-behoben"`;
const dismissLink = (id: string) => `href="/team/triage/${id}/verwerfen"`;

describe("a problem report's own page", () => {
  it("shows the problem report's photo to the technician who triages it (ST-016)", async () => {
    const photo = `problem-reports/${randomUUID()}.jpg`;
    const id = await anUntriagedProblemReport("LG-042", photo);

    const data = await loadProblemReport(db, fixedClock(NOW), id, { storage: memoryStorage() });
    const html = renderToStaticMarkup(createElement(ProblemReportView, { data, role: "technician" }));

    expect(html).toContain(`<img src="memory://${photo}?valid-until=`);
    expect(html).toContain('alt="Foto zur Meldung"');
  });

  it("ST-017: Triaging happens on the problem report's own page", async () => {
    const machine = await executeCommand(
      registerMachineCommand,
      {
        machineModelId,
        museumNumber: "LG-042",
        serialNumber: undefined,
        location: "Hall 2",
        machineStatus: "playable",
      },
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

  it("ST-018: Recording a defect is offered on the problem report's page", async () => {
    const id = await anUntriagedProblemReport();

    const html = await page(id, "technician");

    expect(html).toContain("Sichten");
    expect(html).toContain(recordDefectLink(id));
    expect(html).toContain("Defekt erfassen");
  });

  it("ST-018: Helpers cannot record defects", async () => {
    const id = await anUntriagedProblemReport();

    expect(await page(id, "helper")).not.toContain(recordDefectLink(id));
    const tried = await executeCommand(
      recordDefectCommand,
      {
        problemReportId: id,
        version: 0,
        title: "Left flipper weak",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      { actor: anna, db, newId: randomUUID },
    );
    expect(tried).toEqual({ ok: false, error: "not-authorized" });
  });

  it("ST-018: Recording a defect is not offered on a triaged problem report", async () => {
    const id = await anUntriagedProblemReport();
    const triaged = await executeCommand(
      triageForTest,
      { problemReportId: id, version: 0 },
      { actor: eva, db, newId: randomUUID },
    );
    if (!triaged.ok) throw new Error("not triaged");

    const html = await page(id, "technician");

    expect(html).toContain("Diese Meldung ist schon gesichtet.");
    expect(html).not.toContain(recordDefectLink(id));
  });

  it("ST-019: Resolving on the spot is offered on the problem report's page", async () => {
    const id = await anUntriagedProblemReport();

    for (const role of ["helper", "technician"] as const) {
      const html = await page(id, role);
      expect(html).toContain("Sichten");
      expect(html).toContain(resolveOnTheSpotLink(id));
      expect(html).toContain("Direkt behoben");
    }
    // The order of the outcomes (G21): „Defekt erfassen“ before „Direkt behoben“.
    const html = await page(id, "technician");
    expect(html.indexOf(recordDefectLink(id))).toBeLessThan(html.indexOf(resolveOnTheSpotLink(id)));
  });

  it("ST-019: Resolving on the spot is not offered on a triaged problem report", async () => {
    const id = await anUntriagedProblemReport();
    const triaged = await executeCommand(
      triageForTest,
      { problemReportId: id, version: 0 },
      { actor: eva, db, newId: randomUUID },
    );
    if (!triaged.ok) throw new Error("not triaged");

    for (const role of ["helper", "technician"] as const) {
      const html = await page(id, role);
      expect(html).toContain("Diese Meldung ist schon gesichtet.");
      expect(html).not.toContain(resolveOnTheSpotLink(id));
    }
  });

  it("ST-020: Dismissing is offered on the problem report's page", async () => {
    const id = await anUntriagedProblemReport();

    const html = await page(id, "technician");

    expect(html).toContain("Sichten");
    expect(html).toContain(dismissLink(id));
    expect(html).toContain("Meldung verwerfen");
    // The order of the outcomes (G21): „Defekt erfassen“, „Direkt behoben“, „Meldung verwerfen“.
    expect(html.indexOf(resolveOnTheSpotLink(id))).toBeLessThan(html.indexOf(dismissLink(id)));
  });

  it("ST-020: Dismissing is not offered on a triaged problem report", async () => {
    const id = await anUntriagedProblemReport();
    const triaged = await executeCommand(
      triageForTest,
      { problemReportId: id, version: 0 },
      { actor: eva, db, newId: randomUUID },
    );
    if (!triaged.ok) throw new Error("not triaged");

    const html = await page(id, "technician");

    expect(html).toContain("Diese Meldung ist schon gesichtet.");
    expect(html).not.toContain(dismissLink(id));
  });

  it("ST-020: Helpers cannot dismiss", async () => {
    const id = await anUntriagedProblemReport();

    expect(await page(id, "helper")).not.toContain(dismissLink(id));
    const tried = await executeCommand(
      dismissProblemReportCommand,
      { problemReportId: id, version: 0, reason: "not-a-fault", reasonText: "" },
      { actor: anna, db, newId: randomUUID },
    );
    expect(tried).toEqual({ ok: false, error: "not-authorized" });
  });
});

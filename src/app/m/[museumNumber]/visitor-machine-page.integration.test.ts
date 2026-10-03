import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { changeMachineStatusCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { triageForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { visitorMessages } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadVisitorMachinePage } from "./visitor-machine-page-data";
import { VisitorMachinePage } from "./visitor-machine-page";

/**
 * The visitor machine page (RM-VisitorMachinePage, ST-010): its data, loaded fresh for every request, rendered by its
 * view. In a database of its own, so "LG-042" can be arranged.
 */
const isolated = isolatedTestDatabase("visitor_machine_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const hanna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom Technician");
  await anExistingTeamMember(db, hanna, "Hanna Helper");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
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
    { machineModelId: medievalMadness, museumNumber, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function page(museumNumber: string, locale: "de" | "en" = "de"): Promise<string> {
  const data = await loadVisitorMachinePage(db, museumNumber);
  if (!data) throw new Error(`no visitor machine page for ${museumNumber}`);
  return renderToStaticMarkup(createElement(VisitorMachinePage, { data, museumNumber, messages: visitorMessages(locale) }));
}

describe("the visitor machine page", () => {
  it("ST-010: Changes are visible immediately", async () => {
    const machineId = await registered("LG-042");
    expect(await page("LG-042")).toContain("Status: Spielbereit");

    const changed = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "out-of-order", reason: "coil burnt" },
      { actor: tom, db, newId: randomUUID },
    );
    if (!changed.ok) throw new Error("not changed");

    expect(await page("LG-042")).toContain("Status: Außer Betrieb");
  });

  it("ST-012: Helper takes an unsafe machine out of play", async () => {
    const machineId = await registered("LG-042");

    const changed = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "out-of-order", reason: "glass cracked – unsafe" },
      { actor: hanna, db, newId: randomUUID },
    );

    expect(changed).toEqual({ ok: true, result: { museumNumber: "LG-042", machineStatus: "out-of-order" } });
    expect(await page("LG-042")).toContain("Status: Außer Betrieb");
  });

  it("shows no problem report text, no team member name and no internal ID – its data loads none", async () => {
    const machineId = await registered("LG-042");
    await executeCommand(
      reportProblemCommand,
      { machineId, description: "Secret ball stuck text" },
      { actor: { kind: "visitor" }, db, newId: randomUUID },
    );

    const html = await page("LG-042", "en");

    expect(html).toContain("Williams · 1997"); // the title is the page heading (Page), outside the view
    expect(html).not.toContain("Secret ball stuck text");
    expect(html).not.toContain("Tom Technician");
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("ST-013: Visitor machine page shows the number of untriaged problem reports", async () => {
    const machineId = await registered("LG-042");
    await reported(machineId, "Ball stuck behind the left ramp", "2026-10-02T15:00:00Z");
    await reported(machineId, "Left flipper weak", "2026-10-03T09:00:00Z");

    const html = await page("LG-042");

    expect(html).toContain("2 Meldungen warten noch auf die Sichtung durch das Team.");
    expect(await page("LG-042", "en")).toContain("2 reports are waiting to be checked by the team.");
    expect(html).not.toContain("Ball stuck behind the left ramp");
    expect(html).not.toContain("Left flipper weak");
  });

  it("ST-013: One untriaged problem report is shown in singular", async () => {
    const machineId = await registered("LG-042");
    await reported(machineId, "Ball stuck behind the left ramp", "2026-10-03T09:00:00Z");

    expect(await page("LG-042")).toContain("1 Meldung wartet noch auf die Sichtung durch das Team.");
    expect(await page("LG-042", "en")).toContain("1 report is waiting to be checked by the team.");
  });

  it("ST-013: No hint without untriaged problem reports", async () => {
    await registered("LG-042");

    expect(await page("LG-042")).not.toContain("Sichtung");
    expect(await page("LG-042", "en")).not.toContain("waiting");
  });

  it("counts only untriaged problem reports – a triaged one no longer waits (ST-017)", async () => {
    const machineId = await registered("LG-042");
    await reported(machineId, "Ball stuck behind the left ramp", "2026-10-02T15:00:00Z");
    const [triaged] = await problemReportsOfMachine(db, machineId);
    await reported(machineId, "Left flipper weak", "2026-10-03T09:00:00Z");
    const outcome = await executeCommand(
      triageForTest,
      { problemReportId: triaged.id, version: 0 },
      { actor: tom, db, newId: randomUUID },
    );
    if (!outcome.ok) throw new Error("not triaged");

    expect(await page("LG-042")).toContain("1 Meldung wartet noch auf die Sichtung durch das Team.");
  });
});

async function reported(machineId: string, description: string, at: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
}

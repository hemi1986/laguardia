import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { changeMaintenancePlanCommand, maintenancePlanVersion, recordMaintenanceCommand } from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import {
  recordDefectCommand,
  reportProblemCommand,
  resolveDefectCommand,
  retireMachineCommand,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineOverview } from "./machine-overview-data";
import { MachineOverview } from "./machine-overview";

/**
 * The machine overview's data – Collection's machines with Repair's number of open defects per machine (the page
 * composes, ST-009) – rendered by its view. In a database of its own, so "LG-042" can be arranged.
 */
const isolated = isolatedTestDatabase("machine_overview_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const clock = fixedClock("2026-10-04T10:00:00Z");
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  await withoutMaintenanceTasks(db);
});

/** A playable machine, registered on 1 June 2025 – long before any maintenance task of the tests starts. */
async function registered(museumNumber: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function anOpenDefect(machineId: string, title: string) {
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description: title },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  const recorded = await executeCommand(
    recordDefectCommand,
    {
      problemReportId: reported.result.problemReportId,
      version: 0,
      title,
      priority: undefined,
      suitableForHelpers: false,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!recorded.ok) throw new Error(recorded.error);
  return recorded.result.defectId;
}

/**
 * A maintenance task every machine gets, every 3 months from 1 January 2026 – so on a machine without a record it has
 * been overdue since late April, and on 4 October 2026 (the test's clock).
 */
async function aMaintenanceTask(name: string) {
  const outcome = await executeCommand(
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
    { actor: tom, db, clock: fixedClock("2025-12-01T09:00:00Z"), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.maintenanceTaskId;
}

/** The maintenance task recorded as done on the machine, on that day (CMD-RecordMaintenance). */
async function recordedDone(maintenanceTaskId: string, machineId: string, on: string) {
  const outcome = await executeCommand(
    recordMaintenanceCommand,
    { maintenanceTaskId, machineId, outcome: "done", date: undefined, note: "" },
    { actor: tom, db, clock: fixedClock(`${on}T09:00:00Z`), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
}

async function retire(machineId: string) {
  const outcome = await executeCommand(
    retireMachineCommand,
    { machineId, version: 0, reason: "Sold" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
}

/** The overview as a team member sees it for a search and a filter. */
async function overview(query: Parameters<typeof loadMachineOverview>[2] = {}) {
  const data = await loadMachineOverview(db, clock, query);
  return renderToStaticMarkup(createElement(MachineOverview, { ...data, query, canRegister: false }));
}

/** The entry of a machine in the rendered overview – its title line up to the next entry. */
function entryOf(html: string, museumNumber: string): string | undefined {
  const at = html.indexOf(`${museumNumber} · Medieval Madness`);
  if (at < 0) return undefined;
  const next = html.indexOf("</li>", at);
  return html.slice(at, next);
}

describe("retired machines in the machine overview", () => {
  it("ST-055: Retired machines leave the machine overview", async () => {
    await registered("LG-012");
    await retire(await registered("LG-013"));

    const html = await overview();

    expect(entryOf(html, "LG-012")).toBeDefined();
    expect(entryOf(html, "LG-013")).toBeUndefined();
  });

  it("ST-055: Team members find retired machines with a filter", async () => {
    await registered("LG-012");
    await retire(await registered("LG-013"));

    const html = await overview({ retired: true });

    expect(entryOf(html, "LG-012")).not.toContain("Ausgemustert");
    expect(entryOf(html, "LG-013")).toContain("Ausgemustert");
    expect(entryOf(html, "LG-013")).not.toContain("Status:");
    expect(html).toContain('name="retired"');
    expect(html).not.toContain("Kein Gerät ist ausgemustert.");
  });

  it("ST-055: The filter says when no machine is retired", async () => {
    await registered("LG-012");

    const html = await overview({ retired: true });

    expect(entryOf(html, "LG-012")).toBeDefined();
    expect(html).toContain("Kein Gerät ist ausgemustert.");
  });

  it("ST-055: Search by museum number finds retired machines", async () => {
    await registered("LG-012");
    await retire(await registered("LG-013"));

    const html = await overview({ search: "013" });

    expect(entryOf(html, "LG-012")).toBeUndefined();
    expect(entryOf(html, "LG-013")).toContain("Ausgemustert");
  });

  it("keeps the filter form when every machine is retired, so they can still be found", async () => {
    await retire(await registered("LG-013"));

    const html = await overview();

    expect(html).not.toContain("Noch kein Gerät erfasst.");
    expect(html).toContain("Alle Geräte sind ausgemustert.");
    expect(html).toContain('name="retired"');
    expect(entryOf(await overview({ retired: true }), "LG-013")).toContain("Ausgemustert");
  });

  it("lists retired machines only under all machines, never under a machine status (user, 2026-10-25)", async () => {
    await retire(await registered("LG-013"));

    expect(entryOf(await overview({ retired: true, machineStatus: "playable" }), "LG-013")).toBeUndefined();
    expect(entryOf(await overview({ search: "013", machineStatus: "playable" }), "LG-013")).toBeUndefined();
  });
});

describe("the machine overview with open defects", () => {
  it("ST-021: Machine overview shows the number of open defects", async () => {
    const lg042 = await registered("LG-042");
    await registered("LG-007");
    await anOpenDefect(lg042, "Left flipper weak");
    await anOpenDefect(lg042, "Display flickers");
    const coinDoor = await anOpenDefect(lg042, "Coin door jammed");
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId: coinDoor, version: 0, closingNote: "Fixed" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);

    const data = await loadMachineOverview(db, clock, {});

    expect(data.machines.map((machine) => [machine.museumNumber, machine.openDefects])).toEqual([
      ["LG-007", 0],
      ["LG-042", 2],
    ]);
    const html = renderToStaticMarkup(createElement(MachineOverview, { ...data, query: {}, canRegister: false }));
    const lg007At = html.indexOf("LG-007 · Medieval Madness");
    const lg042At = html.indexOf("LG-042 · Medieval Madness");
    expect(html.slice(lg042At)).toContain("2 offene Defekte");
    expect(html.slice(lg007At, lg042At)).not.toContain("offene"); // a zero is not shown (ST-008)
  });
});

describe("the machine overview with overdue maintenance tasks", () => {
  it("ST-057: Machine overview shows the number of overdue maintenance tasks", async () => {
    await registered("LG-042");
    const lg043 = await registered("LG-043");
    const glass = await aMaintenanceTask("Clean the glass");
    const rubbers = await aMaintenanceTask("Check the rubbers");
    await recordedDone(glass, lg043, "2026-10-01");
    await recordedDone(rubbers, lg043, "2026-10-01");

    const html = await overview();

    expect(entryOf(html, "LG-042")).toContain("2 Wartungsaufgaben überfällig");
    expect(entryOf(html, "LG-043")).toBeDefined();
    expect(entryOf(html, "LG-043")).not.toContain("Wartung"); // a zero is not shown (G6)
  });
});

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createMachineModelCommand,
  registerMachineCommand,
  type MachineCategory,
  type Technology,
} from "@/modules/collection";
import { retireMachineForTest, withoutMachines } from "@/modules/collection/machines.test-support";
import { changeMaintenancePlanCommand, maintenancePlanVersion } from "@/modules/maintenance";
import { removeMaintenanceTaskForTest, withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadDueMaintenance, type DueMaintenanceFilter } from "./due-maintenance-data";
import { DueMaintenanceView } from "./due-maintenance";

/**
 * The due maintenance list (RM-DueMaintenance, ST-043): Maintenance's maintenance tasks, due on Collection's machines –
 * the page composes (ST-009) –, computed when the page loads (ADR 0002). In a database of its own, so "nothing is due"
 * and exact counts can be arranged. Without maintenance records (ST-044), a task's start date is its last done.
 */
const isolated = isolatedTestDatabase("due_maintenance");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const models = new Map<string, string>();

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
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

/** A machine model of the category and technology, once per combination. */
async function modelOf(machineCategory: MachineCategory, technology: Technology | undefined) {
  const key = `${machineCategory}/${technology}`;
  if (!models.has(key)) {
    const created = await run(
      executeCommand(
        createMachineModelCommand,
        { title: `Medieval Madness ${key}`, manufacturer: "Williams", machineCategory, technology },
        { actor: tom, db, newId: randomUUID },
      ),
    );
    models.set(key, created.machineModelId);
  }
  return models.get(key)!;
}

/** A playable machine of that kind, registered at that time. */
async function aMachine(
  museumNumber: string,
  {
    machineCategory = "pinball",
    technology = "dmd",
    location = "Hall 1, row 1",
    registeredAt = "2025-06-01T09:00:00Z",
  }: Partial<{
    machineCategory: MachineCategory;
    technology: Technology | undefined;
    location: string;
    registeredAt: string;
  }> = {},
) {
  const registered = await run(
    executeCommand(
      registerMachineCommand,
      {
        machineModelId: await modelOf(machineCategory, technology),
        museumNumber,
        serialNumber: undefined,
        location,
        machineStatus: "playable",
      },
      { actor: tom, db, clock: fixedClock(registeredAt), newId: randomUUID },
    ),
  );
  return registered.machineId;
}

/** A maintenance task in the maintenance plan – its start date counts as last done. */
async function aMaintenanceTask(
  name: string,
  {
    intervalMonths = 3,
    machineCategory = undefined,
    technology = undefined,
    suitableForHelpers = false,
    startDate = "2026-01-01",
  }: Partial<{
    intervalMonths: number;
    machineCategory: MachineCategory;
    technology: Technology;
    suitableForHelpers: boolean;
    startDate: string;
  }> = {},
) {
  const added = await run(
    executeCommand(
      changeMaintenancePlanCommand,
      {
        version: await maintenancePlanVersion(db),
        change: "add",
        task: {
          name,
          instruction: `${name} – how to`,
          intervalMonths,
          suitableForHelpers,
          machineCategory,
          technology,
          startDate,
        },
      },
      { actor: tom, db, clock: fixedClock("2025-12-01T09:00:00Z"), newId: randomUUID },
    ),
  );
  return added.maintenanceTaskId;
}

/** The page on that day – as a team member sees it, with the filter and the chosen maintenance task. */
async function page(on: string, filter: DueMaintenanceFilter = {}) {
  const data = await loadDueMaintenance(db, fixedClock(`${on}T10:00:00Z`), filter);
  return { data, html: renderToStaticMarkup(createElement(DueMaintenanceView, { data })) };
}

describe("the due maintenance list", () => {
  it("ST-043: Maintenance task becomes due", async () => {
    await aMachine("LG-042", { location: "Hall 1, row 3", registeredAt: "2025-06-01T09:00:00Z" });
    const cleanPlayfield = await aMaintenanceTask("Clean playfield", { intervalMonths: 3, machineCategory: "pinball" });

    const { data, html } = await page("2026-04-02", { maintenanceTaskId: cleanPlayfield });

    expect(data.chosen?.machines).toEqual([
      expect.objectContaining({
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness pinball/dmd",
        location: "Hall 1, row 3",
        lastDone: "2026-01-01",
        dueSince: "2026-04-01",
        overdue: false,
      }),
    ]);
    expect(html).toContain("Zuletzt erledigt 01.01.2026 · fällig seit 01.04.2026");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042"[^>]*>LG-042<\/a>/);
  });
});

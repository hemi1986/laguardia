import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { claimDefectCommand, reportProblemAndTriageCommand } from "@/modules/repair";
import { changeMaintenancePlanCommand, maintenancePlanVersion } from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadHelperDashboard } from "./helper-dashboard-data";
import { HelperDashboard } from "./helper-dashboard";

/**
 * The helper dashboard (RM-HelperDashboard, ST-049): Repair's open defects – claimed by the helper, suitable for helpers
 * – with Collection's machines, and Maintenance's due maintenance tasks suitable for helpers – the page composes
 * (ST-009) –, computed when it is opened (ADR 0002). In a database of its own, so "nothing is open" can be arranged.
 */
const isolated = isolatedTestDatabase("helper_dashboard");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let machineModelId: string;
const NOW = "2026-06-10T10:00:00Z";

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
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

/** A playable machine – with that museum number, or the next one – registered at that time. */
async function aMachine(museumNumber?: string, registeredAt = "2026-01-01T09:00:00Z") {
  const registered = await run(
    executeCommand(
      registerMachineCommand,
      { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
      as(registeredAt),
    ),
  );
  return registered.machineId;
}

/** A maintenance task every 3 months from 2026-01-01 – due from 2026-04-01 on a machine registered before. */
async function aMaintenanceTask(name: string, suitableForHelpers: boolean) {
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
          suitableForHelpers,
          machineCategory: undefined,
          technology: undefined,
          startDate: "2026-01-01",
        },
      },
      as("2025-12-01T09:00:00Z"),
    ),
  );
}

/** An open defect Tom reported and recorded in one step (ST-023) – at version 0. */
async function anOpenDefect(
  title: string,
  { suitableForHelpers = false, museumNumber = undefined as string | undefined } = {},
) {
  const reported = await run(
    executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId: await aMachine(museumNumber),
        description: `${title} – first seen`,
        triage: {
          outcome: "defect-recorded",
          title,
          priority: undefined,
          suitableForHelpers,
          machineStatus: undefined,
          machineVersion: undefined,
        },
      },
      as("2026-06-01T10:00:00Z"),
    ),
  );
  return reported.defectId!;
}

async function dashboard() {
  const data = await loadHelperDashboard(db, fixedClock(NOW), { id: anna.teamMemberId, role: "helper" });
  return { data, html: renderToStaticMarkup(createElement(HelperDashboard, { data })) };
}

describe("the helper dashboard", () => {
  it("ST-049: Helper sees open defects suitable for helpers", async () => {
    await anOpenDefect("Rubber cracked", { suitableForHelpers: true });
    await anOpenDefect("Display flickers");

    const { data, html } = await dashboard();

    expect(data.suitableForHelpers.map((defect) => defect.title)).toEqual(["Rubber cracked"]);
    expect(html).toContain("Rubber cracked");
    expect(html).not.toContain("Display flickers");
  });

  it("ST-049: Helper sees her claimed defects first", async () => {
    const defectId = await anOpenDefect("Slingshot switch loose", { suitableForHelpers: true, museumNumber: "LG-042" });
    await run(executeCommand(claimDefectCommand, { defectId, version: 0 }, { ...as(NOW), actor: anna }));

    const { data, html } = await dashboard();

    expect(data.claimedByYou.map(({ title, museumNumber }) => ({ title, museumNumber }))).toEqual([
      { title: "Slingshot switch loose", museumNumber: "LG-042" },
    ]);
    // The first section, and only there – her claim is not repeated among the defects suitable for helpers (user, 2026-10-24).
    expect(html.indexOf("Von dir übernommen")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("Von dir übernommen")).toBeLessThan(html.indexOf("Slingshot switch loose"));
    expect(html.indexOf("Slingshot switch loose")).toBeLessThan(html.indexOf("Für Helfer:innen geeignet"));
    expect(html.split("Slingshot switch loose")).toHaveLength(2);
    expect(html).toContain("LG-042 · Medieval Madness");
  });

  it("ST-049: Helper sees due maintenance tasks suitable for helpers as counts", async () => {
    // Registered before the start date, so due since 2026-04-01 – overdue by NOW; the other two due since 2026-06-01.
    await aMachine("LG-042");
    await aMachine("LG-043", "2026-03-01T09:00:00Z");
    await aMachine("LG-044", "2026-03-01T09:00:00Z");
    await aMaintenanceTask("Clean glass (inside & out)", true);
    await aMaintenanceTask("Check fuses, connectors, boards for burn marks", false);

    const { data, html } = await dashboard();

    expect(data.dueMaintenance).toEqual([{ name: "Clean glass (inside & out)", machineCount: 3, overdueCount: 1 }]);
    expect(html).toContain("„Clean glass (inside &amp; out)“ ist an 3 Geräten fällig, 1 davon überfällig.");
    expect(html).not.toContain("Check fuses");
    expect(html).toMatch(/<a [^>]*href="\/team\/maintenance\?helpers=1"[^>]*>Zur Wartung<\/a>/);
  });
});

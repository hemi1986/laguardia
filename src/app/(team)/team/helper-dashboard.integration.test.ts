import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { claimDefectCommand, reportProblemAndTriageCommand, resolveDefectCommand } from "@/modules/repair";
import { changeMaintenancePlanCommand, maintenancePlanVersion, recordMaintenanceCommand } from "@/modules/maintenance";
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

/** A maintenance task every 3 months for those machines, added on that day – due at once on each of them (ST-094). */
async function aMaintenanceTask(name: string, suitableForHelpers: boolean, machineIds: string[], addedOn: string) {
  const added = await run(
    executeCommand(
      changeMaintenancePlanCommand,
      {
        version: await maintenancePlanVersion(db),
        change: "add",
        task: { name, instruction: `${name} – how to`, intervalMonths: 3, suitableForHelpers, machineIds },
      },
      as(`${addedOn}T09:00:00Z`),
    ),
  );
  return added.maintenanceTaskId;
}

/** The task done on the machine on that day – due again one interval later. */
async function doneOn(maintenanceTaskId: string, machineId: string, on: string) {
  await run(
    executeCommand(
      recordMaintenanceCommand,
      { maintenanceTaskId, machineId, outcome: "done", date: undefined, note: "" },
      as(`${on}T10:00:00Z`),
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
    // Added on 2026-02-01 and never done on LG-042 – due since then, overdue by NOW; done on the other two on
    // 2026-03-01 – due since 2026-06-01.
    const [lg042, lg043, lg044] = [await aMachine("LG-042"), await aMachine("LG-043"), await aMachine("LG-044")];
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", true, [lg042, lg043, lg044], "2026-02-01");
    await aMaintenanceTask("Check fuses, connectors, boards for burn marks", false, [lg042, lg043, lg044], "2026-02-01");
    await doneOn(cleanGlass, lg043, "2026-03-01");
    await doneOn(cleanGlass, lg044, "2026-03-01");

    const { data, html } = await dashboard();

    expect(data.dueMaintenance).toEqual([
      { id: expect.any(String), name: "Clean glass (inside & out)", machineCount: 3, overdueCount: 1 },
    ]);
    expect(html).toContain("„Clean glass (inside &amp; out)“ ist an 3 Geräten fällig, 1 davon überfällig.");
    expect(html).not.toContain("Check fuses");
    expect(html).toMatch(/<a [^>]*href="\/team\/maintenance\?helpers=1"[^>]*>Zur Wartung<\/a>/);
  });

  it("ST-049: Nothing is open for a helper", async () => {
    // A defect not suitable for helpers, and a maintenance task suitable for helpers that is due from 2026-08-01 only.
    await anOpenDefect("Display flickers");
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", true, [lg042], "2026-05-01");
    await doneOn(cleanGlass, lg042, "2026-05-01");

    const { html } = await dashboard();

    expect(html).toBe("<p>Gerade ist nichts für dich offen.</p>");
  });

  it("ST-049: An empty section says so next to a filled one", async () => {
    await anOpenDefect("Rubber cracked", { suitableForHelpers: true });

    const { html } = await dashboard();

    expect(html).toContain("Du hast keinen Defekt übernommen.");
    expect(html.indexOf("Du hast keinen Defekt übernommen.")).toBeLessThan(html.indexOf("Für Helfer:innen geeignet"));
    expect(html.indexOf("Für Helfer:innen geeignet")).toBeLessThan(html.indexOf("Rubber cracked"));
    // The maintenance section says it has nothing too, in the due maintenance list's words – and offers no link.
    expect(html).toContain("Gerade ist keine Wartung für Helfer:innen fällig.");
    expect(html).not.toContain("Zur Wartung");
  });

  it("ST-049: Resolved defects leave the dashboard", async () => {
    const defectId = await anOpenDefect("Rubber cracked", { suitableForHelpers: true });
    // Claimed by Anna first, so it leaves her first section as well.
    await run(executeCommand(claimDefectCommand, { defectId, version: 0 }, { ...as(NOW), actor: anna }));
    expect((await dashboard()).data.claimedByYou.map((defect) => defect.title)).toEqual(["Rubber cracked"]);

    await run(
      executeCommand(
        resolveDefectCommand,
        { defectId, version: 1, closingNote: "Rubber replaced" },
        { ...as(NOW), actor: anna },
      ),
    );

    const { data, html } = await dashboard();

    expect(data.suitableForHelpers).toEqual([]);
    expect(data.claimedByYou).toEqual([]);
    expect(html).not.toContain("Rubber cracked");
  });

  it("keeps a defect someone else claims among the defects suitable for helpers, saying who claims it", async () => {
    const defectId = await anOpenDefect("Rubber cracked", { suitableForHelpers: true });
    await run(executeCommand(claimDefectCommand, { defectId, version: 0 }, as(NOW)));

    const { data, html } = await dashboard();

    expect(data.claimedByYou).toEqual([]);
    expect(data.suitableForHelpers.map((defect) => defect.title)).toEqual(["Rubber cracked"]);
    expect(html.indexOf("Rubber cracked")).toBeLessThan(html.indexOf("Übernommen von Tom"));
  });

  it("says no further defect is open for helpers when the helper claims the only one (user, 2026-10-24)", async () => {
    const defectId = await anOpenDefect("Rubber cracked", { suitableForHelpers: true });
    await run(executeCommand(claimDefectCommand, { defectId, version: 0 }, { ...as(NOW), actor: anna }));

    const { html } = await dashboard();

    expect(html).toContain("Gerade ist kein weiterer Defekt für Helfer:innen offen.");
    expect(html).not.toContain("Gerade ist kein Defekt für Helfer:innen offen.");
  });
});

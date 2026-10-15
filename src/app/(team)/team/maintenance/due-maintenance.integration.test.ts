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
import {
  changeMaintenancePlanCommand,
  maintenancePlanVersion,
  maintenanceRecords,
  recordMaintenanceCommand,
  type MaintenanceOutcome,
} from "@/modules/maintenance";
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
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const models = new Map<string, string>();

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
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

/** A maintenance record made on that day, for that day (CMD-RecordMaintenance, ST-044). */
async function recorded(
  maintenanceTaskId: string,
  machineId: string,
  on: string,
  {
    outcome = "done",
    note = "",
    actor = tom,
  }: { outcome?: MaintenanceOutcome; note?: string; actor?: typeof tom | typeof anna } = {},
) {
  return run(
    executeCommand(
      recordMaintenanceCommand,
      { maintenanceTaskId, machineId, outcome, date: undefined, note },
      { actor, db, clock: fixedClock(`${on}T10:00:00Z`), newId: randomUUID },
    ),
  );
}

/** The museum numbers the chosen maintenance task lists on that day. */
async function listedOn(on: string, maintenanceTaskId: string) {
  return (await page(on, { maintenanceTaskId })).data.chosen?.machines.map((machine) => machine.museumNumber) ?? [];
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

  it("ST-043: Machine registered after the start date", async () => {
    const cleanPlayfield = await aMaintenanceTask("Clean playfield", { intervalMonths: 3, machineCategory: "pinball" });
    await aMachine("LG-061", { registeredAt: "2026-05-15T08:00:00Z" });

    // Due since 1 April for machines registered before the start date – not for LG-061.
    const june = await page("2026-06-01", { maintenanceTaskId: cleanPlayfield });
    expect(june.data.tasks).toEqual([]);
    expect(june.html).not.toContain("LG-061");

    const august = await page("2026-08-15", { maintenanceTaskId: cleanPlayfield });
    expect(august.data.chosen?.machines).toEqual([
      expect.objectContaining({ museumNumber: "LG-061", lastDone: "2026-05-15", dueSince: "2026-08-15" }),
    ]);
    expect((await page("2026-08-14")).data.tasks).toEqual([]);
  });

  it("ST-043: The list first shows each due maintenance task with its counts", async () => {
    // On the pinball machines: due since 1 April 2026 (3 months), overdue from 24 April on the three registered before
    // the start date; the nine registered on 25 January are due since 25 April, not yet overdue on 1 May.
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", {
      intervalMonths: 3,
      machineCategory: "pinball",
      startDate: "2026-01-01",
    });
    // On the two arcade machines: due since 25 April (1 month), overdue only from 3 May.
    await aMaintenanceTask("Wax playfield", { intervalMonths: 1, machineCategory: "arcade", startDate: "2026-03-25" });
    for (const number of ["001", "002", "003"])
      await aMachine(`LG-${number}`, { registeredAt: "2025-06-01T09:00:00Z" });
    for (let index = 0; index < 9; index++) {
      await aMachine(`LG-1${String(index).padStart(2, "0")}`, { registeredAt: "2026-01-25T09:00:00Z" });
    }
    await aMachine("LG-201", { machineCategory: "arcade", technology: "crt", registeredAt: "2025-06-01T09:00:00Z" });
    await aMachine("LG-202", { machineCategory: "arcade", technology: "lcd", registeredAt: "2025-06-01T09:00:00Z" });

    const { data, html } = await page("2026-05-01");

    expect(data.tasks.map(({ name, machineCount, overdueCount }) => [name, machineCount, overdueCount])).toEqual([
      ["Clean glass (inside & out)", 12, 3],
      ["Wax playfield", 2, 0],
    ]);
    expect(html.match(/Clean glass \(inside &amp; out\)/g)).toHaveLength(1);
    expect(html).toContain("Clean glass (inside &amp; out) · 12 Geräte, 3 überfällig");
    expect(html).toContain("Wax playfield · 2 Geräte<");
    expect(html).toContain(`href="/team/maintenance?task=${cleanGlass}"`);
    expect(html).not.toContain("LG-0");
    expect(html).not.toContain("LG-1");
  });

  it("ST-043: Due maintenance tasks are grouped by maintenance task and sorted by location", async () => {
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", { suitableForHelpers: true });
    await aMachine("LG-044", { location: "Hall 2, row 1" });
    await aMachine("LG-042", { location: "Hall 1, row 3" });
    await aMachine("LG-043", { location: "Hall 1, row 1" });
    await aMachine("LG-045", { location: "Hall 1, row 10" });

    const { data, html } = await page("2026-04-02", { maintenanceTaskId: cleanGlass });

    expect(html).toContain("Clean glass (inside &amp; out) – how to");
    expect(html).toContain("Für Helfer:innen geeignet");
    // "row 3" before "row 10", as people read it.
    expect(data.chosen?.machines.map((machine) => machine.museumNumber)).toEqual([
      "LG-043",
      "LG-042",
      "LG-045",
      "LG-044",
    ]);
    expect(html.indexOf("LG-043")).toBeLessThan(html.indexOf("LG-042"));
    expect(html.indexOf("LG-042")).toBeLessThan(html.indexOf("LG-044"));
  });

  it("ST-043: Nothing is due", async () => {
    await aMachine("LG-042");
    await aMaintenanceTask("Clean playfield", { intervalMonths: 3, startDate: "2026-01-01" });

    const { data, html } = await page("2026-03-31");

    expect(data).toMatchObject({ tasks: [], chosen: undefined });
    expect(html).toContain("Gerade ist keine Wartung fällig.");
    expect(html).not.toContain("Clean playfield");
    expect(html).not.toContain("LG-042");
  });

  it("ST-043: Filter suitable for helpers", async () => {
    await aMachine("LG-042");
    await aMaintenanceTask("Clean glass (inside & out)", { suitableForHelpers: true });
    const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", {
      suitableForHelpers: false,
    });

    // Unfiltered, both are due.
    expect((await page("2026-04-02")).data.tasks.map((task) => task.name).sort()).toEqual([
      "Check fuses, connectors, boards for burn marks",
      "Clean glass (inside & out)",
    ]);

    const { data, html } = await page("2026-04-02", { suitableForHelpers: true });

    expect(data.tasks.map((task) => task.name)).toEqual(["Clean glass (inside & out)"]);
    expect(html).not.toContain("Check fuses");
    expect(html).toMatch(/<input[^>]*name="helpers"[^>]*checked=""/);
    // A task the filter leaves out cannot be chosen past it.
    expect(
      (await page("2026-04-02", { suitableForHelpers: true, maintenanceTaskId: fuses })).data.chosen,
    ).toBeUndefined();
    // And when none is suitable, it says so.
    expect((await page("2026-03-01", { suitableForHelpers: true })).html).toContain(
      "Gerade ist keine Wartung für Helfer:innen fällig.",
    );
  });

  it("ST-043: Maintenance task becomes overdue after 25% of the interval", async () => {
    await aMachine("LG-042", { registeredAt: "2024-06-01T09:00:00Z" });
    // Without maintenance records (ST-044): the start date is the last done.
    const wax = await aMaintenanceTask("Wax playfield", { intervalMonths: 12, startDate: "2025-01-01" });

    const march = await page("2026-03-01", { maintenanceTaskId: wax });
    expect(march.data.chosen?.machines).toEqual([
      expect.objectContaining({ museumNumber: "LG-042", dueSince: "2026-01-01", overdue: false }),
    ]);
    expect(march.html).not.toContain("Überfällig");

    // 365 days × 25 % = 91.25 → 92 days after the due date.
    expect((await page("2026-04-02", { maintenanceTaskId: wax })).data.chosen?.machines[0].overdue).toBe(false);
    const april = await page("2026-04-03", { maintenanceTaskId: wax });
    expect(april.data.chosen?.machines[0].overdue).toBe(true);
    expect(april.html).toContain("Überfällig");
    expect(april.data.tasks).toEqual([{ id: wax, name: "Wax playfield", machineCount: 1, overdueCount: 1 }]);
  });

  it("ST-043: Restriction decides which machines are listed", async () => {
    await aMachine("LG-042", { machineCategory: "pinball", technology: "dmd" });
    await aMachine("LG-005", { machineCategory: "pinball", technology: "em" });
    const reels = await aMaintenanceTask("Clean & adjust score reels / stepper units", {
      machineCategory: "pinball",
      technology: "em",
    });

    const { data } = await page("2026-04-02", { maintenanceTaskId: reels });

    expect(data.chosen?.machines.map((machine) => machine.museumNumber)).toEqual(["LG-005"]);
  });

  it("ST-043: Retired machines and removed maintenance tasks are not listed", async () => {
    const lg013 = await aMachine("LG-013");
    await aMachine("LG-042");
    await aMaintenanceTask("Clean playfield");
    const wax = await aMaintenanceTask("Wax playfield");
    await run(
      executeCommand(
        retireMachineForTest,
        { machineId: lg013, version: 0 },
        { actor: tom, db, clock: fixedClock("2026-02-01T09:00:00Z"), newId: randomUUID },
      ),
    );
    await run(
      executeCommand(
        removeMaintenanceTaskForTest,
        { maintenanceTaskId: wax, version: await maintenancePlanVersion(db) },
        { actor: tom, db, clock: fixedClock("2026-02-01T09:00:00Z"), newId: randomUUID },
      ),
    );

    const { data, html } = await page("2026-04-02");

    expect(data.tasks.map(({ name, machineCount }) => [name, machineCount])).toEqual([["Clean playfield", 1]]);
    expect(html).not.toContain("Wax playfield");
    const chosen = await page("2026-04-02", { maintenanceTaskId: data.tasks[0].id });
    expect(chosen.html).toContain("LG-042");
    expect(chosen.html).not.toContain("LG-013");
  });

  it("shows the tasks with the most overdue machines first, then the most due machines, then by name", async () => {
    // Registered before the start dates: overdue on 1 May. Registered on 25 January: due since 25 April, not overdue.
    for (const number of ["001", "002"]) await aMachine(`LG-${number}`, { registeredAt: "2025-06-01T09:00:00Z" });
    await aMachine("LG-101", { technology: "em", registeredAt: "2026-01-25T09:00:00Z" });
    await aMachine("LG-102", { technology: "em", registeredAt: "2026-01-25T09:00:00Z" });
    await aMaintenanceTask("B – overdue on two", { machineCategory: "pinball", technology: "dmd" });
    await aMaintenanceTask("C – due on two", { machineCategory: "pinball", technology: "em" });
    await aMaintenanceTask("A – due on two", { machineCategory: "pinball", technology: "em" });
    await aMaintenanceTask("D – due on four, overdue on two", { machineCategory: "pinball" });

    const { data } = await page("2026-05-01");

    expect(data.tasks.map(({ name, machineCount, overdueCount }) => [name, machineCount, overdueCount])).toEqual([
      ["D – due on four, overdue on two", 4, 2],
      ["B – overdue on two", 2, 2],
      ["A – due on two", 2, 0],
      ["C – due on two", 2, 0],
    ]);
  });

  describe("after maintenance is recorded (ST-044)", () => {
    it("ST-044: Helper records maintenance as done", async () => {
      const lg042 = await aMachine("LG-042");
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", {
        intervalMonths: 1,
        suitableForHelpers: true,
      });
      expect(await listedOn("2026-06-10", cleanGlass)).toEqual(["LG-042"]);

      await recorded(cleanGlass, lg042, "2026-06-10", { actor: anna });

      expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([
        expect.objectContaining({
          maintenanceTaskId: cleanGlass,
          outcome: "done",
          date: "2026-06-10",
          recordedBy: anna.teamMemberId,
        }),
      ]);
      expect(await listedOn("2026-06-10", cleanGlass)).toEqual([]);
      expect((await page("2026-06-10")).html).not.toContain("Clean glass");
      // Next due one interval later.
      expect(await listedOn("2026-07-09", cleanGlass)).toEqual([]);
      expect((await page("2026-07-10", { maintenanceTaskId: cleanGlass })).data.chosen?.machines).toEqual([
        expect.objectContaining({ museumNumber: "LG-042", lastDone: "2026-06-10", dueSince: "2026-07-10" }),
      ]);
    });

    it("ST-044: Recording a task that is not due restarts the interval", async () => {
      const lg042 = await aMachine("LG-042");
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", { intervalMonths: 1 });
      await recorded(cleanGlass, lg042, "2026-06-01");
      expect(await listedOn("2026-06-15", cleanGlass)).toEqual([]);

      await recorded(cleanGlass, lg042, "2026-06-15");

      // Not due on 1 July any more, as the record of 1 June would have made it – but on 15 July.
      expect(await listedOn("2026-07-01", cleanGlass)).toEqual([]);
      expect(await listedOn("2026-07-14", cleanGlass)).toEqual([]);
      expect((await page("2026-07-15", { maintenanceTaskId: cleanGlass })).data.chosen?.machines).toEqual([
        expect.objectContaining({ museumNumber: "LG-042", lastDone: "2026-06-15", dueSince: "2026-07-15" }),
      ]);
    });

    it("ST-044: Partially done does not reset the interval", async () => {
      const lg042 = await aMachine("LG-042");
      const switchTest = await aMaintenanceTask("Switch test (every switch)", { intervalMonths: 3 });
      expect(await listedOn("2026-06-10", switchTest)).toEqual(["LG-042"]);

      await recorded(switchTest, lg042, "2026-06-10", {
        outcome: "partially-done",
        note: "Switch matrix row 3 not tested – shooter lane blocked",
      });

      expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([
        expect.objectContaining({
          maintenanceTaskId: switchTest,
          outcome: "partially-done",
          note: "Switch matrix row 3 not tested – shooter lane blocked",
        }),
      ]);
      expect((await page("2026-06-10", { maintenanceTaskId: switchTest })).data.chosen?.machines).toEqual([
        expect.objectContaining({ museumNumber: "LG-042", lastDone: "2026-01-01", dueSince: "2026-04-01" }),
      ]);
    });
  });
});

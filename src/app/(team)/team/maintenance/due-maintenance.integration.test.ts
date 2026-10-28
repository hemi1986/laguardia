import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aMaintenanceTaskIn, removeMaintenanceTaskIn } from "@/test-support/maintenance";
import {
  changeMachineStatusCommand,
  correctMachineModelCommand,
  createMachineModelCommand,
  registerMachineCommand,
  type MachineCategory,
  type MachineStatus,
  type Technology,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { retireMachineCommand } from "@/modules/repair";
import {
  changeMaintenancePlanCommand,
  maintenancePlan,
  maintenanceRecords,
  recordMaintenanceCommand,
  type MaintenanceOutcome,
  type MaintenanceTaskDetails,
} from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { formRunner } from "@/app/_actions/form-runner";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { post } from "@/test-support/forms";
import { dueMaintenanceFilterOf, loadDueMaintenance, type DueMaintenanceFilter } from "./due-maintenance-data";
import { DueMaintenanceView } from "./due-maintenance";
import { loadMaintenanceForRecording } from "./erfassen/record-maintenance-data";
import { RecordMaintenancePage } from "./erfassen/record-maintenance-view";
import { loadRecordForSeveral } from "./mehrere/record-for-several-data";
import { RecordForSeveralPage } from "./mehrere/record-for-several-view";
import { recordMaintenanceFields, recordMaintenanceInput } from "./erfassen/record-maintenance-input";
import {
  recordedForSeveralAddress,
  recordForSeveralFields,
  recordForSeveralInput,
} from "./mehrere/record-for-several-input";
import { loadMaintenancePlan } from "../maintenance-plan/maintenance-plan-data";
import { MaintenancePlanView } from "../maintenance-plan/maintenance-plan";

/**
 * The due maintenance list (RM-DueMaintenance, ST-043): Maintenance's maintenance tasks, due on Collection's machines
 * (Maintenance reads them), computed when the page loads (ADR 0002). In a database of its own, so "nothing is due"
 * and exact counts can be arranged. A task is due at once on every machine it newly applies to (ST-094); without a
 * maintenance record (ST-044) recorded since, that is its due date.
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

/**
 * A maintenance task in the maintenance plan for those machines, added on that day – by default 1 April 2026: due at
 * once on each of them (ST-094), so without a record it is due since then.
 */
async function aMaintenanceTask(
  name: string,
  machineIds: string[],
  {
    intervalMonths = 3,
    suitableForHelpers = false,
    addedOn = "2026-04-01",
  }: Partial<{ intervalMonths: number; suitableForHelpers: boolean; addedOn: string }> = {},
) {
  return aMaintenanceTaskIn(db, {
    name,
    machineIds,
    intervalMonths,
    suitableForHelpers,
    at: `${addedOn}T09:00:00Z`,
    by: tom,
  });
}

/** The maintenance task changed by Tom on that day – everything else as the maintenance plan lists it now. */
async function changed(maintenanceTaskId: string, changes: Partial<MaintenanceTaskDetails>, on = "2026-02-01") {
  const plan = await maintenancePlan(db);
  const task = plan.maintenanceTasks.find((each) => each.id === maintenanceTaskId)!;
  const { instruction, intervalMonths, suitableForHelpers } = task;
  return run(
    executeCommand(
      changeMaintenancePlanCommand,
      {
        version: plan.version,
        change: "change",
        maintenanceTaskId,
        task: { instruction, intervalMonths, suitableForHelpers, ...changes },
      },
      { actor: tom, db, clock: fixedClock(`${on}T09:00:00Z`), newId: randomUUID },
    ),
  );
}

/** The maintenance task removed from the maintenance plan by Tom on that day. */
async function removed(maintenanceTaskId: string, on = "2026-02-01") {
  await removeMaintenanceTaskIn(db, maintenanceTaskId, { at: `${on}T09:00:00Z`, by: tom });
}

/** The machine's status changed by Tom on that day – `version`: the machine's version before the change. */
async function statusChanged(machineId: string, version: number, machineStatus: MachineStatus, on: string) {
  await run(
    executeCommand(
      changeMachineStatusCommand,
      { machineId, version, machineStatus, reason: `Now ${machineStatus}` },
      { actor: tom, db, clock: fixedClock(`${on}T08:00:00Z`), newId: randomUUID },
    ),
  );
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
async function page(on: string, filter: DueMaintenanceFilter = {}, viewer: typeof tom | typeof anna = tom) {
  const data = await loadDueMaintenance(db, fixedClock(`${on}T10:00:00Z`), filter, {
    id: viewer.teamMemberId,
    role: viewer.role,
  });
  return { data, html: renderToStaticMarkup(createElement(DueMaintenanceView, { data })) };
}

/** The maintenance plan as Tom sees it, back from a change – `params`: the address the change led to. */
async function planPage(params: Record<string, string> = {}) {
  const data = await loadMaintenancePlan(db, tom.teamMemberId, params);
  return { data, html: renderToStaticMarkup(createElement(MaintenancePlanView, data)) };
}

describe("the due maintenance list", () => {
  it("ST-094: The task is due at once on every chosen machine", async () => {
    const lg005 = await aMachine("LG-005", { location: "Hall 1, row 3" });
    const lg042 = await aMachine("LG-042", { location: "Hall 1, row 4" });
    await aMachine("LG-020");
    // Today is 10 June 2026.
    const wax = await aMaintenanceTask("Wax playfield", [lg005, lg042], { intervalMonths: 12, addedOn: "2026-06-10" });

    const { data, html } = await page("2026-06-10", { maintenanceTaskId: wax });

    expect(data.chosen?.machines).toEqual([
      expect.objectContaining({
        museumNumber: "LG-005",
        machineModelTitle: "Medieval Madness pinball/dmd",
        location: "Hall 1, row 3",
        lastDone: undefined,
        dueSince: "2026-06-10",
        overdue: false,
      }),
      expect.objectContaining({ museumNumber: "LG-042", lastDone: undefined, dueSince: "2026-06-10" }),
    ]);
    expect(html).toContain("Noch nicht erledigt · fällig seit 10.06.2026");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-005"[^>]*>LG-005<\/a>/);
    expect(html).not.toContain("LG-020");
  });

  it("ST-094: Each machine's interval runs on its own", async () => {
    const lg005 = await aMachine("LG-005");
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg005, lg042], {
      intervalMonths: 1,
      addedOn: "2026-06-01",
    });
    expect((await page("2026-06-01", { maintenanceTaskId: cleanGlass })).data.chosen?.machines).toHaveLength(2);

    await recorded(cleanGlass, lg005, "2026-06-03");
    await recorded(cleanGlass, lg042, "2026-06-20");

    expect(await listedOn("2026-07-02", cleanGlass)).toEqual([]);
    expect((await page("2026-07-03", { maintenanceTaskId: cleanGlass })).data.chosen?.machines).toEqual([
      expect.objectContaining({ museumNumber: "LG-005", lastDone: "2026-06-03", dueSince: "2026-07-03" }),
    ]);
    expect((await page("2026-07-20", { maintenanceTaskId: cleanGlass })).data.chosen?.machines).toEqual([
      expect.objectContaining({ museumNumber: "LG-005", dueSince: "2026-07-03" }),
      expect.objectContaining({ museumNumber: "LG-042", lastDone: "2026-06-20", dueSince: "2026-07-20" }),
    ]);
  });

  it("ST-043: The list first shows each due maintenance task with its counts", async () => {
    // Twelve pinball machines: Clean glass is added on 1 January 2026 (3 months), so it is due since then and overdue
    // from 24 January on the three it was never done on; the nine it was done on 25 January are due since 25 April,
    // not yet overdue on 1 May.
    const pinball: string[] = [];
    for (const number of ["001", "002", "003"]) pinball.push(await aMachine(`LG-${number}`));
    const doneInJanuary: string[] = [];
    for (let index = 0; index < 9; index++) doneInJanuary.push(await aMachine(`LG-1${String(index).padStart(2, "0")}`));
    const lg201 = await aMachine("LG-201", { machineCategory: "arcade", technology: "crt" });
    const lg202 = await aMachine("LG-202", { machineCategory: "arcade", technology: "lcd" });
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [...pinball, ...doneInJanuary], {
      addedOn: "2026-01-01",
    });
    for (const machineId of doneInJanuary) await recorded(cleanGlass, machineId, "2026-01-25");
    // On the two arcade machines: due since 25 April (1 month), overdue only from 3 May.
    await aMaintenanceTask("Wax playfield", [lg201, lg202], { intervalMonths: 1, addedOn: "2026-04-25" });

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
    const machines = [
      await aMachine("LG-044", { location: "Hall 2, row 1" }),
      await aMachine("LG-042", { location: "Hall 1, row 3" }),
      await aMachine("LG-043", { location: "Hall 1, row 1" }),
      await aMachine("LG-045", { location: "Hall 1, row 10" }),
    ];
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", machines, { suitableForHelpers: true });

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
    const lg042 = await aMachine("LG-042");
    const cleanPlayfield = await aMaintenanceTask("Clean playfield", [lg042], { addedOn: "2026-03-01" });
    await recorded(cleanPlayfield, lg042, "2026-03-15");

    const { data, html } = await page("2026-03-31");

    expect(data).toMatchObject({ tasks: [], chosen: undefined });
    expect(html).toContain("Gerade ist keine Wartung fällig.");
    expect(html).not.toContain("Clean playfield");
    expect(html).not.toContain("LG-042");
  });

  it("ST-043: Filter suitable for helpers", async () => {
    const lg042 = await aMachine("LG-042");
    await aMaintenanceTask("Clean glass (inside & out)", [lg042], { suitableForHelpers: true });
    const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042], {
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
    const lg042 = await aMachine("LG-042");
    // Without maintenance records (ST-044): due at once, since the day the machine was added to the task.
    const wax = await aMaintenanceTask("Wax playfield", [lg042], { intervalMonths: 12, addedOn: "2026-01-01" });

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

  it("ST-043: Retired machines and removed maintenance tasks are not listed", async () => {
    const lg013 = await aMachine("LG-013");
    const lg042 = await aMachine("LG-042");
    await aMaintenanceTask("Clean playfield", [lg013, lg042]);
    const wax = await aMaintenanceTask("Wax playfield", [lg013, lg042]);
    await run(
      executeCommand(
        retireMachineCommand,
        { machineId: lg013, version: 0, reason: "Sold" },
        { actor: tom, db, clock: fixedClock("2026-02-01T09:00:00Z"), newId: randomUUID },
      ),
    );
    await removed(wax, "2026-02-01");

    const { data, html } = await page("2026-04-02");

    expect(data.tasks.map(({ name, machineCount }) => [name, machineCount])).toEqual([["Clean playfield", 1]]);
    expect(html).not.toContain("Wax playfield");
    const chosen = await page("2026-04-02", { maintenanceTaskId: data.tasks[0].id });
    expect(chosen.html).toContain("LG-042");
    expect(chosen.html).not.toContain("LG-013");
  });

  it("ST-094: A machine retired later no longer counts", async () => {
    const lg005 = await aMachine("LG-005");
    const lg044 = await aMachine("LG-044");
    const wax = await aMaintenanceTask("Wax playfield", [lg005, lg044]);
    expect(await listedOn("2026-04-02", wax)).toEqual(["LG-005", "LG-044"]);
    const countOf = async () =>
      (await planPage()).data.plan.maintenanceTasks.find((task) => task.id === wax)?.machineCount;
    expect(await countOf()).toBe(2);

    await run(
      executeCommand(
        retireMachineCommand,
        { machineId: lg044, version: 0, reason: "Sold" },
        { actor: tom, db, clock: fixedClock("2026-04-02T09:00:00Z"), newId: randomUUID },
      ),
    );

    expect(await countOf()).toBe(1);
    expect((await planPage()).html).toContain("Gilt für 1 Gerät");
    expect(await listedOn("2026-04-02", wax)).toEqual(["LG-005"]);
    const several = await loadRecordForSeveral(db, fixedClock("2026-04-02T10:00:00Z"), wax, {
      id: tom.teamMemberId,
      role: tom.role,
    });
    expect([...(several?.due ?? []), ...(several?.others ?? [])].map((machine) => machine.museumNumber)).toEqual([
      "LG-005",
    ]);
  });

  it("shows the tasks with the most overdue machines first, then the most due machines, then by name", async () => {
    // LG-001 and LG-002 never had any of it done: overdue on 1 May. LG-101 and LG-102 had D done on 25 January – due
    // since 25 April, not overdue – and are on A and C, which are added on 25 April.
    const [lg001, lg002] = [await aMachine("LG-001"), await aMachine("LG-002")];
    const [lg101, lg102] = [await aMachine("LG-101"), await aMachine("LG-102")];
    await aMaintenanceTask("B – overdue on two", [lg001, lg002]);
    await aMaintenanceTask("C – due on two", [lg101, lg102], { addedOn: "2026-04-25" });
    await aMaintenanceTask("A – due on two", [lg101, lg102], { addedOn: "2026-04-25" });
    const d = await aMaintenanceTask("D – due on four, overdue on two", [lg001, lg002, lg101, lg102], {
      addedOn: "2026-01-01",
    });
    await recorded(d, lg101, "2026-01-25");
    await recorded(d, lg102, "2026-01-25");

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
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042], {
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
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042], { intervalMonths: 1 });
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
      const switchTest = await aMaintenanceTask("Switch test (every switch)", [lg042]);
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
        expect.objectContaining({ museumNumber: "LG-042", lastDone: undefined, dueSince: "2026-04-01" }),
      ]);
    });
  });

  describe("„Wartung erfassen“ from the list (ST-044)", () => {
    /** The form „Wartung erfassen“ through the Server Action runner, as that team member on that day. */
    function formOf(actor: typeof tom | typeof anna, on: string) {
      const recordedIds: string[] = [];
      const action = formRunner({
        currentPerson: async () => actor,
        db,
        clock: fixedClock(`${on}T10:00:00Z`),
        newId: randomUUID,
      })(recordMaintenanceCommand, {
        fields: recordMaintenanceFields,
        input: recordMaintenanceInput,
        onSuccess: async ({ maintenanceRecordId }) => void recordedIds.push(maintenanceRecordId),
      });
      return { action, recordedIds };
    }

    it("offers „Wartung erfassen“ on each due machine – to helpers only for tasks suitable for helpers", async () => {
      const lg042 = await aMachine("LG-042");
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042], { suitableForHelpers: true });
      const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042]);

      const link = (task: string) => `href="/team/maintenance/erfassen?task=${task}&amp;machine=LG-042"`;
      expect((await page("2026-04-02", { maintenanceTaskId: cleanGlass }, anna)).html).toContain(link(cleanGlass));
      expect((await page("2026-04-02", { maintenanceTaskId: fuses }, anna)).html).not.toContain(link(fuses));
      expect((await page("2026-04-02", { maintenanceTaskId: fuses }, tom)).html).toContain(link(fuses));
    });

    it("shows the form page with the task and the machine, and says why to someone it would refuse", async () => {
      const lg042 = await aMachine("LG-042", { location: "Hall 1, row 3" });
      const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042]);
      const clock = fixedClock("2026-06-10T10:00:00Z");
      const asAnna = { id: anna.teamMemberId, role: anna.role };

      const forTom = await loadMaintenanceForRecording(db, clock, fuses, "LG-042", {
        id: tom.teamMemberId,
        role: "technician",
      });
      expect(forTom).toMatchObject({
        maintenanceTask: { id: fuses, name: "Check fuses, connectors, boards for burn marks" },
        machine: {
          museumNumber: "LG-042",
          machineModelTitle: "Medieval Madness pinball/dmd",
          location: "Hall 1, row 3",
        },
        whyNot: undefined,
        today: "2026-06-10",
        earliest: "2026-06-03",
      });
      const html = renderToStaticMarkup(createElement(RecordMaintenancePage, { data: forTom! }));
      expect(html).toMatch(/<input[^>]*type="date"[^>]*value="2026-06-10"/);
      expect(html).toContain('min="2026-06-03"');
      expect(html).toContain('max="2026-06-10"');

      const forAnna = await loadMaintenanceForRecording(db, clock, fuses, "LG-042", asAnna);
      expect(forAnna?.whyNot).toBe("maintenance-not-suitable-for-helpers");
      expect(renderToStaticMarkup(createElement(RecordMaintenancePage, { data: forAnna! }))).toContain(
        "Diese Wartungsaufgabe ist nicht für Helfer:innen geeignet.",
      );
      expect(await loadMaintenanceForRecording(db, clock, fuses, "LG-999", asAnna)).toBeUndefined();
      expect(await loadMaintenanceForRecording(db, clock, randomUUID(), "LG-042", asAnna)).toBeUndefined();
    });

    it("records it as the signed-in team member, and the list confirms it", async () => {
      const lg042 = await aMachine("LG-042");
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042], {
        intervalMonths: 1,
        suitableForHelpers: true,
      });
      const form = formOf(anna, "2026-06-10");

      const fields = { maintenanceTaskId: cleanGlass, machineId: lg042, outcome: "done", date: "2026-06-10", note: "" };
      expect(await form.action(null, post(fields))).toBeNull();

      expect(form.recordedIds).toHaveLength(1);
      const after = await page("2026-06-10", { maintenanceTaskId: cleanGlass, recorded: [form.recordedIds[0]] }, anna);
      expect(after.html).toContain("Wartung an LG-042 eingetragen.");
      // An address naming someone else's record, or no record, confirms nothing.
      expect((await page("2026-06-10", { recorded: [form.recordedIds[0]] }, tom)).html).not.toContain("eingetragen");
      expect((await page("2026-06-10", { recorded: [randomUUID()] }, anna)).html).not.toContain("eingetragen");
    });

    it("keeps what was typed when it is rejected – a forged role is not read", async () => {
      const lg042 = await aMachine("LG-042");
      const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042]);
      const typed = {
        maintenanceTaskId: fuses,
        machineId: lg042,
        outcome: "partially-done",
        date: "2026-06-02",
        note: "Row 3",
      };

      const tooEarly = await formOf(tom, "2026-06-10").action(null, post(typed));
      expect(tooEarly).toEqual({ error: "date-too-early", values: typed });
      expect(commandErrorText(teamMessages, tooEarly!.error)).toBe(
        "Bitte ein Datum aus den letzten 7 Tagen angeben – nicht früher.",
      );
      expect((await formOf(tom, "2026-06-10").action(null, post({ ...typed, outcome: "", date: "" })))?.error).toBe(
        "outcome-required",
      );

      const byHelper = await formOf(anna, "2026-06-10").action(null, post({ ...typed, date: "", role: "technician" }));
      expect(byHelper?.error).toBe("maintenance-not-suitable-for-helpers");
      expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([]);
    });
  });

  describe("machines not on display and returning to display (ST-056)", () => {
    it("ST-056: Machines not on display are never due", async () => {
      const lg030 = await aMachine("LG-030");
      await aMaintenanceTask("Clean glass (inside & out)", [lg030], { intervalMonths: 1, addedOn: "2024-06-01" });
      await statusChanged(lg030, 0, "not-on-display", "2024-07-01");

      const { data, html } = await page("2026-06-10");

      expect(data.tasks).toEqual([]);
      expect(html).not.toContain("LG-030");
      expect(html).toContain("Gerade ist keine Wartung fällig.");
    });

    it("ST-056: Task already due at the return counts from the return date", async () => {
      const lg030 = await aMachine("LG-030");
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg030], {
        intervalMonths: 1,
        addedOn: "2025-05-01",
      });
      await statusChanged(lg030, 0, "not-on-display", "2025-06-01");

      await statusChanged(lg030, 1, "playable", "2026-06-01");

      expect((await page("2026-06-01", { maintenanceTaskId: cleanGlass })).data.chosen?.machines).toEqual([
        expect.objectContaining({
          museumNumber: "LG-030",
          lastDone: undefined,
          dueSince: "2026-06-01",
          overdue: false,
        }),
      ]);
      // 1 June + 25 % of the 30 days of June, rounded up: overdue from 9 June, not before.
      expect((await page("2026-06-08", { maintenanceTaskId: cleanGlass })).data.chosen?.machines[0].overdue).toBe(
        false,
      );
      expect((await page("2026-06-09", { maintenanceTaskId: cleanGlass })).data.chosen?.machines[0].overdue).toBe(true);
    });

    it("ST-056: Task not yet due at the return follows the normal rule", async () => {
      const lg030 = await aMachine("LG-030");
      const wax = await aMaintenanceTask("Wax playfield", [lg030], { intervalMonths: 12, addedOn: "2025-01-01" });
      await statusChanged(lg030, 0, "not-on-display", "2025-12-01");
      await recorded(wax, lg030, "2026-03-01");

      await statusChanged(lg030, 1, "playable", "2026-06-01");

      expect(await listedOn("2026-06-01", wax)).toEqual([]);
      expect(await listedOn("2027-02-28", wax)).toEqual([]);
      expect((await page("2027-03-01", { maintenanceTaskId: wax })).data.chosen?.machines).toEqual([
        expect.objectContaining({ museumNumber: "LG-030", lastDone: "2026-03-01", dueSince: "2027-03-01" }),
      ]);
    });

    it("ST-056: Going off display removes a due task from the list", async () => {
      const lg042 = await aMachine("LG-042");
      const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042]);
      expect(await listedOn("2026-04-02", cleanGlass)).toEqual(["LG-042"]);

      await statusChanged(lg042, 0, "not-on-display", "2026-04-02");

      expect(await listedOn("2026-04-02", cleanGlass)).toEqual([]);
      expect((await page("2026-04-02")).data.tasks).toEqual([]);
    });

    it("ST-094: A machine not on display becomes due on its return", async () => {
      const lg030 = await aMachine("LG-030");
      await statusChanged(lg030, 0, "not-on-display", "2026-03-01");
      const cleanPlayfield = await aMaintenanceTask("Clean playfield", [lg030], { addedOn: "2026-04-01" });

      // Not due while it is Not on display – however long that is.
      expect((await page("2026-09-30")).data.tasks).toEqual([]);

      await statusChanged(lg030, 1, "playable", "2026-10-01");

      expect(await listedOn("2026-09-30", cleanPlayfield)).toEqual([]);
      expect((await page("2026-10-01", { maintenanceTaskId: cleanPlayfield })).data.chosen?.machines).toEqual([
        expect.objectContaining({ museumNumber: "LG-030", lastDone: undefined, dueSince: "2026-10-01" }),
      ]);
    });
  });
});

describe("a machine model correction (ST-094: it changes nothing in maintenance)", () => {
  /** A machine model of its own – the one the scenario corrects –, with one machine registered on 1 June 2025. */
  async function aMachineOfItsOwnModel(
    museumNumber: string,
    title: string,
    machineCategory: MachineCategory,
    technology: Technology,
  ) {
    const details = { title, manufacturer: "Bally", machineCategory, technology };
    const { machineModelId } = await run(
      executeCommand(createMachineModelCommand, details, { actor: tom, db, newId: randomUUID }),
    );
    const { machineId } = await run(
      executeCommand(
        registerMachineCommand,
        { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
        { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
      ),
    );
    let version = 0;
    /** Tom corrects the technology on that day, at the version the model has. */
    const technologyCorrected = (newTechnology: Technology, on: string) =>
      run(
        executeCommand(
          correctMachineModelCommand,
          { machineModelId, version: version++, ...details, technology: newTechnology },
          { actor: tom, db, clock: fixedClock(`${on}T08:00:00Z`), newId: randomUUID },
        ),
      );
    return { machineId, technologyCorrected };
  }

  it("ST-094: A machine model correction changes nothing in maintenance", async () => {
    const lg005 = await aMachineOfItsOwnModel("LG-005", "Fireball", "pinball", "solid-state");
    const scoreReels = await aMaintenanceTask("Clean & adjust score reels / stepper units", [lg005.machineId], {
      intervalMonths: 3,
      addedOn: "2026-04-01",
    });
    const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg005.machineId], {
      intervalMonths: 3,
      addedOn: "2026-04-01",
    });
    await recorded(scoreReels, lg005.machineId, "2026-05-01");
    const dueBefore = (await page("2026-08-01")).data.tasks.map(({ name, machineCount }) => [name, machineCount]);

    await lg005.technologyCorrected("em", "2026-06-01");

    // Still applies to LG-005, next due as before – counted from 1 May, not from the correction.
    expect(await listedOn("2026-07-31", scoreReels)).toEqual([]);
    expect((await page("2026-08-01", { maintenanceTaskId: scoreReels })).data.chosen?.machines).toEqual([
      expect.objectContaining({ museumNumber: "LG-005", lastDone: "2026-05-01", dueSince: "2026-08-01" }),
    ]);
    // And no task starts or stops applying: what is due is exactly what was.
    expect((await page("2026-08-01")).data.tasks.map(({ name, machineCount }) => [name, machineCount])).toEqual(
      dueBefore,
    );
    expect(await listedOn("2026-08-01", fuses)).toEqual(["LG-005"]);
  });
});

describe("changing and removing a maintenance task (ST-041)", () => {
  it("ST-041: Technician changes the interval", async () => {
    const lg042 = await aMachine("LG-042");
    const cleanPlayfield = await aMaintenanceTask("Clean playfield", [lg042], { addedOn: "2025-12-01" });
    await recorded(cleanPlayfield, lg042, "2026-01-01");

    await changed(cleanPlayfield, { intervalMonths: 2 }, "2026-01-15");

    const { data } = await page("2026-03-02", { maintenanceTaskId: cleanPlayfield });
    expect(data.chosen?.machines).toEqual([
      expect.objectContaining({ museumNumber: "LG-042", lastDone: "2026-01-01", dueSince: "2026-03-01" }),
    ]);
    expect((await planPage({ changed: cleanPlayfield })).html).toContain(
      teamMessages.maintenancePlan.changed("Clean playfield"),
    );
  });

  it("ST-041: Technician changes the suitable-for-helpers mark", async () => {
    const lg042 = await aMachine("LG-042");
    const fuses = await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042], {
      suitableForHelpers: false,
    });
    expect((await page("2026-04-02", { suitableForHelpers: true })).data.tasks).toEqual([]);

    await changed(fuses, { suitableForHelpers: true });

    const plan = await planPage();
    expect(plan.data.plan.maintenanceTasks).toEqual([expect.objectContaining({ id: fuses, suitableForHelpers: true })]);
    expect(plan.html).toContain(teamMessages.terms["Suitable for helpers"]);
    const forHelpers = await page("2026-04-02", { suitableForHelpers: true, maintenanceTaskId: fuses });
    expect(forHelpers.data.tasks.map((task) => task.id)).toEqual([fuses]);
    expect(forHelpers.data.chosen?.suitableForHelpers).toBe(true);
    expect(forHelpers.html).toContain(teamMessages.terms["Suitable for helpers"]);
  });

  it("ST-041: Technician removes a maintenance task", async () => {
    const lg042 = await aMachine("LG-042");
    const lg043 = await aMachine("LG-043");
    const wax = await aMaintenanceTask("Wax playfield", [lg042, lg043], { intervalMonths: 12, addedOn: "2026-01-01" });
    await recorded(wax, lg042, "2026-01-10");
    await recorded(wax, lg043, "2026-01-12", { outcome: "partially-done", note: "Only the lower half" });

    await removed(wax, "2026-02-01");

    const plan = await planPage({ removed: wax });
    expect(plan.data.plan.maintenanceTasks.map((task) => task.name)).not.toContain("Wax playfield");
    expect(plan.html).toContain(teamMessages.maintenancePlan.removed("Wax playfield"));
    for (const on of ["2027-01-11", "2030-06-01"]) {
      expect((await page(on)).data.tasks.map((task) => task.name)).not.toContain("Wax playfield");
    }
    expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([
      expect.objectContaining({ maintenanceTaskId: wax, outcome: "done", date: "2026-01-10" }),
    ]);
    expect(await maintenanceRecords(db, { machineId: lg043 })).toEqual([
      expect.objectContaining({ maintenanceTaskId: wax, outcome: "partially-done", note: "Only the lower half" }),
    ]);
  });
});

describe("„Für mehrere Geräte erfassen“ (ST-045)", () => {
  /**
   * The form „Für mehrere Geräte erfassen“ through the Server Action runner, as that team member on that day – one
   * CMD-RecordMaintenance per chosen machine. `address` is where the action sends the team member afterwards.
   */
  function severalFormOf(actor: typeof tom | typeof anna, on: string) {
    const form: { address?: string } = {};
    const action = formRunner({
      currentPerson: async () => actor,
      db,
      clock: fixedClock(`${on}T10:00:00Z`),
      newId: randomUUID,
    })(recordMaintenanceCommand, {
      fields: recordForSeveralFields,
      each: { field: "machineId" },
      input: recordForSeveralInput,
      onSuccess: async (outcome) => void (form.address = recordedForSeveralAddress(outcome)),
    });
    return Object.assign(form, { action });
  }

  /** The form as the browser posts it: its fields, and one `machineId` per ticked machine. */
  function ticked(fields: Record<string, string>, machineIds: readonly string[]) {
    const form = post(fields);
    for (const machineId of machineIds) form.append("machineId", machineId);
    return form;
  }

  /** The due maintenance list at the address the action sent the team member to. */
  async function landedOn(address: string | undefined, on: string, viewer: typeof tom | typeof anna) {
    const url = new URL(address ?? "/", "http://localhost");
    expect(url.pathname).toBe("/team/maintenance");
    const params = Object.fromEntries([...url.searchParams.keys()].map((key) => [key, url.searchParams.getAll(key)]));
    return page(on, dueMaintenanceFilterOf(params), viewer);
  }

  it("ST-045: Helper records a maintenance task for several machines", async () => {
    const machines = [await aMachine("LG-042"), await aMachine("LG-043"), await aMachine("LG-044")];
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", machines, {
      intervalMonths: 1,
      suitableForHelpers: true,
    });
    expect(await listedOn("2026-06-10", cleanGlass)).toEqual(["LG-042", "LG-043", "LG-044"]);
    const form = severalFormOf(anna, "2026-06-10");

    const fields = { maintenanceTaskId: cleanGlass, outcome: "done", date: "2026-06-10", note: "" };
    expect(await form.action(null, ticked(fields, machines))).toBeNull();

    for (const machineId of machines)
      expect(await maintenanceRecords(db, { machineId })).toEqual([
        expect.objectContaining({ maintenanceTaskId: cleanGlass, outcome: "done", recordedBy: anna.teamMemberId }),
      ]);
    expect(await listedOn("2026-06-10", cleanGlass)).toEqual([]);
    const after = await landedOn(form.address, "2026-06-10", anna);
    expect(after.html).toContain("„Clean glass (inside &amp; out)“ an 3 Geräten eingetragen.");
    // Only the team member who recorded them sees the confirmation.
    expect((await landedOn(form.address, "2026-06-10", tom)).html).not.toContain("eingetragen");
  });
  /** The selection page „Für mehrere Geräte erfassen“ of that task on that day, as that team member sees it. */
  async function selection(on: string, maintenanceTaskId: string, viewer: typeof tom | typeof anna) {
    const data = await loadRecordForSeveral(db, fixedClock(`${on}T10:00:00Z`), maintenanceTaskId, {
      id: viewer.teamMemberId,
      role: viewer.role,
    });
    return { data, html: data ? renderToStaticMarkup(createElement(RecordForSeveralPage, { data })) : "" };
  }

  /** The checkbox of that machine in the rendered selection – none when it is not offered. */
  function checkboxOf(html: string, machineId: string) {
    return html.match(new RegExp(`<input type="checkbox"[^>]*value="${machineId}"[^>]*>`))?.[0];
  }

  it("ST-045: Due machines are preselected, all applicable machines can be selected", async () => {
    const lg042 = await aMachine("LG-042", { location: "Hall 2, row 1" });
    const lg045 = await aMachine("LG-045", { location: "Hall 1, row 3" });
    const lg046 = await aMachine("LG-046", { location: "Hall 1, row 10" });
    const lg090 = await aMachine("LG-090", { machineCategory: "arcade", technology: "crt" });
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042, lg045, lg046], {
      suitableForHelpers: true,
      addedOn: "2026-01-01",
    });
    await recorded(cleanGlass, lg045, "2026-03-30");
    await recorded(cleanGlass, lg046, "2026-03-30");
    expect(await listedOn("2026-04-02", cleanGlass)).toEqual(["LG-042"]);

    const { data, html } = await selection("2026-04-02", cleanGlass, anna);

    expect(data?.due.map((machine) => machine.museumNumber)).toEqual(["LG-042"]);
    // By location as people read it: row 3 before row 10.
    expect(data?.others.map((machine) => machine.museumNumber)).toEqual(["LG-045", "LG-046"]);
    expect(checkboxOf(html, lg042)).toContain("checked");
    expect(checkboxOf(html, lg045)).not.toContain("checked");
    expect(html).toContain("Weitere Geräte");
    expect(html).not.toContain(lg090);
    expect(html).not.toContain("LG-090");
  });
  it("ST-094: Recording for several machines offers the machines of the task", async () => {
    const lg042 = await aMachine("LG-042", { location: "Hall 1, row 1" });
    const lg045 = await aMachine("LG-045", { location: "Hall 1, row 2" });
    const lg050 = await aMachine("LG-050", { location: "Hall 1, row 3" });
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042, lg045], {
      addedOn: "2026-01-01",
      suitableForHelpers: true,
    });
    await recorded(cleanGlass, lg045, "2026-03-30");
    expect(await listedOn("2026-04-02", cleanGlass)).toEqual(["LG-042"]);

    const { data, html } = await selection("2026-04-02", cleanGlass, anna);

    expect(data?.due.map((machine) => machine.museumNumber)).toEqual(["LG-042"]);
    expect(data?.others.map((machine) => machine.museumNumber)).toEqual(["LG-045"]);
    expect(checkboxOf(html, lg042)).toContain("checked");
    expect(checkboxOf(html, lg045)).toBeDefined();
    expect(checkboxOf(html, lg050)).toBeUndefined();
  });

  it("ST-045: Machines that are not due can be included", async () => {
    const lg042 = await aMachine("LG-042");
    const lg045 = await aMachine("LG-045");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042, lg045], { intervalMonths: 1 });
    await recorded(cleanGlass, lg045, "2026-06-01");
    expect(await listedOn("2026-06-10", cleanGlass)).toEqual(["LG-042"]);

    const fields = { maintenanceTaskId: cleanGlass, outcome: "done", date: "2026-06-08", note: "" };
    expect(await severalFormOf(tom, "2026-06-10").action(null, ticked(fields, [lg042, lg045]))).toBeNull();

    for (const machineId of [lg042, lg045])
      expect((await maintenanceRecords(db, { machineId }))[0]).toEqual(
        expect.objectContaining({ maintenanceTaskId: cleanGlass, outcome: "done", date: "2026-06-08" }),
      );
    // Both count from the day it was carried out, not from the day it was recorded.
    expect(await listedOn("2026-07-07", cleanGlass)).toEqual([]);
    expect((await page("2026-07-08", { maintenanceTaskId: cleanGlass })).data.chosen?.machines).toEqual([
      expect.objectContaining({ museumNumber: "LG-042", lastDone: "2026-06-08", dueSince: "2026-07-08" }),
      expect.objectContaining({ museumNumber: "LG-045", lastDone: "2026-06-08", dueSince: "2026-07-08" }),
    ]);
  });

  it("ST-045: A machine that fails a rule does not stop the others", async () => {
    const [lg042, lg043, lg044] = [await aMachine("LG-042"), await aMachine("LG-043"), await aMachine("LG-044")];
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042, lg043, lg044], {
      intervalMonths: 1,
      suitableForHelpers: true,
    });
    const form = severalFormOf(anna, "2026-06-10");
    // Anna has the selection open; a moment later a technician retires LG-044.
    await run(
      executeCommand(
        retireMachineCommand,
        { machineId: lg044, version: 0, reason: "Sold" },
        { actor: tom, db, clock: fixedClock("2026-06-10T09:59:00Z"), newId: randomUUID },
      ),
    );

    const fields = { maintenanceTaskId: cleanGlass, outcome: "done", date: "", note: "" };
    expect(await form.action(null, ticked(fields, [lg042, lg043, lg044]))).toBeNull();

    expect(await maintenanceRecords(db, { machineId: lg042 })).toHaveLength(1);
    expect(await maintenanceRecords(db, { machineId: lg043 })).toHaveLength(1);
    expect(await maintenanceRecords(db, { machineId: lg044 })).toEqual([]);
    const { html } = await landedOn(form.address, "2026-06-10", anna);
    expect(html).toContain("„Clean glass (inside &amp; out)“ an 2 Geräten eingetragen.");
    expect(html).toContain("LG-044 nicht eingetragen: Dieses Gerät ist ausgemustert");
    expect(html.indexOf("an 2 Geräten")).toBeLessThan(html.indexOf("LG-044 nicht eingetragen"));
  });

  it("names a machine left out even when Maintenance would accept it now", async () => {
    const [lg042, lg043] = [await aMachine("LG-042"), await aMachine("LG-043")];
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042, lg043], { intervalMonths: 1 });
    const form = severalFormOf(tom, "2026-06-10");
    expect(
      await form.action(null, ticked({ maintenanceTaskId: cleanGlass, outcome: "done", date: "", note: "" }, [lg042])),
    ).toBeNull();
    const address = `${form.address}&notRecorded=${lg043}`;

    const { html } = await landedOn(address, "2026-06-10", tom);

    expect(html).toContain("LG-043 nicht eingetragen – bitte noch einmal erfassen.");
  });

  it("ST-045: Nothing selected is rejected", async () => {
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042], { suitableForHelpers: true });
    const form = severalFormOf(anna, "2026-04-02");

    const fields = { maintenanceTaskId: cleanGlass, outcome: "done", date: "", note: "Hall 1" };
    const state = await form.action(null, ticked(fields, []));

    expect(state).toEqual({ error: "nothing-chosen", values: fields, chosen: [] });
    expect(form.address).toBeUndefined();
    expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([]);
    expect(rejectionText(state!.error)).toBe("Bitte mindestens ein Gerät auswählen.");
  });

  it("ST-045: Helpers cannot record several machines for a task not suitable for helpers", async () => {
    const [lg042, lg043] = [await aMachine("LG-042"), await aMachine("LG-043")];
    const psu = await aMaintenanceTask("Check PSU voltages, connectors, board", [lg042, lg043]);
    const form = severalFormOf(anna, "2026-04-02");

    const fields = { maintenanceTaskId: psu, outcome: "done", date: "", note: "", role: "technician" };
    const state = await form.action(null, ticked(fields, [lg042, lg043]));

    expect(state?.error).toBe("maintenance-not-suitable-for-helpers");
    expect(state?.rejected).toBeUndefined();
    expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([]);
    expect(await maintenanceRecords(db, { machineId: lg043 })).toEqual([]);
    // The selection says why in place of the form, and the list does not offer it.
    expect((await selection("2026-04-02", psu, anna)).html).toContain(
      "Diese Wartungsaufgabe ist nicht für Helfer:innen geeignet.",
    );
    expect((await page("2026-04-02", { maintenanceTaskId: psu }, anna)).html).not.toContain(
      "/team/maintenance/mehrere",
    );
    expect((await page("2026-04-02", { maintenanceTaskId: psu }, tom)).html).toContain(
      `href="/team/maintenance/mehrere?task=${psu}"`,
    );
  });
});

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
import {
  changeMaintenancePlanCommand,
  maintenancePlanVersion,
  recordMaintenanceCommand,
  type MaintenanceOutcome,
} from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import type { Viewer } from "../../claimant";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";
import { loadAllMaintenanceRecords } from "./wartungseintraege/maintenance-records-data";
import { MaintenanceRecordsView } from "./wartungseintraege/maintenance-records";

/**
 * Section 5 of the machine record, „Wartung“ (ST-047): Maintenance's maintenance records and due maintenance tasks of
 * the machine, with Team's names – the page composes (ST-009). In a database of its own, so "nothing due" and exact
 * maintenance plans can be arranged.
 */
const isolated = isolatedTestDatabase("machine_record_maintenance");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
type Person = typeof tom | typeof ben | typeof anna;
let pinballModel: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, ben, "Ben");
  await anExistingTeamMember(db, anna, "Anna");
  pinballModel = (
    await run(
      executeCommand(
        createMachineModelCommand,
        { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball", technology: "dmd" },
        { actor: tom, db, newId: randomUUID },
      ),
    )
  ).machineModelId;
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

/** A playable machine, registered on 1 June 2025. */
async function aMachine(museumNumber: string) {
  return (
    await run(
      executeCommand(
        registerMachineCommand,
        {
          machineModelId: pinballModel,
          museumNumber,
          serialNumber: undefined,
          location: "Hall 1, row 3",
          machineStatus: "playable",
        },
        { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
      ),
    )
  ).machineId;
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

/** A maintenance task in the maintenance plan – its start date counts as last done. */
async function aMaintenanceTask(
  name: string,
  {
    intervalMonths = 3,
    suitableForHelpers = false,
    startDate = "2026-01-01",
  }: Partial<{ intervalMonths: number; suitableForHelpers: boolean; startDate: string }> = {},
) {
  return (
    await run(
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
            machineCategory: undefined,
            technology: undefined,
            startDate,
          },
        },
        { actor: tom, db, clock: fixedClock("2025-12-01T09:00:00Z"), newId: randomUUID },
      ),
    )
  ).maintenanceTaskId;
}

/** A maintenance record made on that day, for that day (CMD-RecordMaintenance, ST-044). */
async function recorded(
  maintenanceTaskId: string,
  machineId: string,
  on: string,
  { outcome = "done", note = "", actor = tom }: { outcome?: MaintenanceOutcome; note?: string; actor?: Person } = {},
) {
  return run(
    executeCommand(
      recordMaintenanceCommand,
      { maintenanceTaskId, machineId, outcome, date: undefined, note },
      { actor, db, clock: fixedClock(`${on}T10:00:00Z`), newId: randomUUID },
    ),
  );
}

function viewerOf(person: Person): Viewer {
  return { id: person.teamMemberId, role: person.role };
}

/** The machine record on that day, as that team member sees it. */
async function page(museumNumber: string, on: string, viewer: Person = tom) {
  const record = await loadMachineRecord(db, museumNumber, {
    clock: fixedClock(`${on}T10:00:00Z`),
    viewer: viewerOf(viewer),
  });
  const html = renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber }));
  const maintenance = section(html, "Wartung");
  const recordsStart = maintenance.indexOf(">Wartungseinträge<");
  return {
    record,
    html,
    maintenance,
    /** The due maintenance tasks – the part of section 5 before its maintenance records. */
    due: maintenance.slice(0, recordsStart),
    /** The maintenance records of section 5. */
    records: maintenance.slice(recordsStart),
  };
}

/** The part of the page from the given section's heading to the next section's. */
function section(html: string, heading: string): string {
  const start = html.indexOf(`>${heading}<`);
  if (start < 0) return "";
  const next = html.indexOf("<section", start);
  return html.slice(start, next < 0 ? undefined : next);
}

/** The notes of the test's maintenance records, in the order the page shows them. */
function notesIn(html: string): string[] {
  return [...html.matchAll(/Glass of \d{4}-\d{2}-\d{2}/g)].map(([note]) => note);
}

describe("section 5 „Wartung“ of the machine record", () => {
  it("ST-047: Machine record shows maintenance records", async () => {
    const lg042 = await aMachine("LG-042");
    const switchTest = await aMaintenanceTask("Switch test (every switch)");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", { suitableForHelpers: true });
    await recorded(switchTest, lg042, "2026-06-02", {
      actor: ben,
      outcome: "partially-done",
      note: "Switch matrix row 3 not tested",
    });
    await recorded(cleanGlass, lg042, "2026-06-10", { actor: anna });

    const { records } = await page("LG-042", "2026-06-10");

    expect(records).toContain("Switch test (every switch)");
    expect(records).toContain("Teilweise erledigt");
    expect(records).toContain("Ben · 02.06.2026");
    expect(records).toContain("Switch matrix row 3 not tested");
    expect(records).toContain(">Erledigt<");
    expect(records).toContain("Anna · 10.06.2026");
    expect(records.indexOf("Clean glass (inside &amp; out)")).toBeGreaterThan(-1);
    expect(records.indexOf("Clean glass (inside &amp; out)")).toBeLessThan(
      records.indexOf("Switch test (every switch)"),
    );
  });

  it("ST-047: Only the 5 latest maintenance records are on the machine record", async () => {
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)");
    for (const day of ["01", "02", "03", "04", "05", "06", "07"]) {
      await recorded(cleanGlass, lg042, `2026-06-${day}`, { note: `Glass of 2026-06-${day}` });
    }

    const { records } = await page("LG-042", "2026-06-07");

    expect(notesIn(records)).toEqual([
      "Glass of 2026-06-07",
      "Glass of 2026-06-06",
      "Glass of 2026-06-05",
      "Glass of 2026-06-04",
      "Glass of 2026-06-03",
    ]);
    expect(records).toMatch(
      /<a [^>]*href="\/team\/machines\/LG-042\/wartungseintraege"[^>]*>Alle Wartungseinträge \(7\)<\/a>/,
    );

    const all = await loadAllMaintenanceRecords(db, "LG-042");
    expect(all?.title).toBe("Wartungseinträge · LG-042");
    const html = renderToStaticMarkup(createElement(MaintenanceRecordsView, { data: all, museumNumber: "LG-042" }));
    expect(notesIn(html)).toEqual([
      "Glass of 2026-06-07",
      "Glass of 2026-06-06",
      "Glass of 2026-06-05",
      "Glass of 2026-06-04",
      "Glass of 2026-06-03",
      "Glass of 2026-06-02",
      "Glass of 2026-06-01",
    ]);
    expect(html).toContain("2026 · 7 Einträge");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042"[^>]*>Zurück zum Gerät<\/a>/);
  });
});

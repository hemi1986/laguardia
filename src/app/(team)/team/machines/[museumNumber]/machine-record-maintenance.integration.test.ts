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
  maintenanceRecords,
  recordMaintenanceCommand,
  type MaintenanceOutcome,
} from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { retireMachineCommand } from "@/modules/repair";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import type { Viewer } from "../../claimant";
import { loadMachineRecord } from "./machine-record-data";
import { MachineRecordView } from "./machine-record";
import { loadMachineConfirmation } from "./machine-confirmation";
import { formRunner } from "@/app/_actions/form-runner";
import { post } from "@/test-support/forms";
import { loadMaintenanceForRecording } from "../../maintenance/erfassen/record-maintenance-data";
import { RecordMaintenancePage } from "../../maintenance/erfassen/record-maintenance-view";
import { recordMaintenanceDefinition } from "../../maintenance/erfassen/record-maintenance-definition";
import { recordMaintenanceReturnOf } from "../../maintenance/erfassen/record-maintenance-address";
import { loadAllMaintenanceRecords } from "./wartungseintraege/maintenance-records-data";
import { MaintenanceRecordsView } from "./wartungseintraege/maintenance-records";

/**
 * Section 5 of the machine record, „Wartung“ (ST-047): Maintenance's maintenance records and due maintenance tasks of
 * the machine, with Team's names. In a database of its own, so "nothing due" and exact
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

/**
 * A maintenance task for those machines, added on that day (by default 1 April 2026) – due at once on each of them
 * (ST-094), so without a record it is due since then and overdue 25 % of the interval later.
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
  return (
    await run(
      executeCommand(
        changeMaintenancePlanCommand,
        {
          version: await maintenancePlanVersion(db),
          change: "add",
          task: { name, instruction: `${name} – how to`, intervalMonths, suitableForHelpers, machineIds },
        },
        { actor: tom, db, clock: fixedClock(`${addedOn}T09:00:00Z`), newId: randomUUID },
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

/** The entry of the page part that names the maintenance task. */
function entryOf(html: string, name: string): string {
  const entry = html.split("<article").find((part) => part.includes(`>${name}<`));
  if (!entry) throw new Error(`${name} is not shown`);
  return entry;
}

/** The machine record at that address – with its query – as that team member sees it on that day (G3). */
async function pageAt(url: URL, on: string, viewer: Person) {
  const museumNumber = decodeURIComponent(url.pathname.split("/").at(-1)!);
  const clock = fixedClock(`${on}T10:00:00Z`);
  const record = await loadMachineRecord(db, museumNumber, { clock, viewer: viewerOf(viewer) });
  const confirmation =
    record &&
    (await loadMachineConfirmation(db, clock, viewer.teamMemberId, record, Object.fromEntries(url.searchParams)));
  const html = renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber, confirmation }));
  const maintenance = section(html, "Wartung");
  return { html, due: maintenance.slice(0, maintenance.indexOf(">Wartungseinträge<")) };
}

describe("section 5 „Wartung“ of the machine record", () => {
  it("ST-047: Machine record shows maintenance records", async () => {
    const lg042 = await aMachine("LG-042");
    const switchTest = await aMaintenanceTask("Switch test (every switch)", [lg042]);
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042], { suitableForHelpers: true });
    await recorded(switchTest, lg042, "2026-06-02", {
      actor: ben,
      outcome: "partially-done",
      note: "Switch matrix row 3 not tested",
    });
    await recorded(cleanGlass, lg042, "2026-06-10", { actor: anna });

    const { records } = await page("LG-042", "2026-06-10");

    const switchEntry = entryOf(records, "Switch test (every switch)");
    expect(switchEntry).toContain(">Teilweise erledigt<");
    expect(switchEntry).toContain("Ben · 02.06.2026");
    expect(switchEntry).toContain("Switch matrix row 3 not tested");
    const glassEntry = entryOf(records, "Clean glass (inside &amp; out)");
    expect(glassEntry).toContain(">Erledigt<");
    expect(glassEntry).toContain("Anna · 10.06.2026");
    expect(glassEntry).not.toContain("Switch matrix");
    expect(records.indexOf("Clean glass (inside &amp; out)")).toBeGreaterThan(-1);
    expect(records.indexOf("Clean glass (inside &amp; out)")).toBeLessThan(
      records.indexOf("Switch test (every switch)"),
    );
  });

  it("ST-047: Only the 5 latest maintenance records are on the machine record", async () => {
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042]);
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

  it("ST-047: Machine record shows due and overdue maintenance tasks", async () => {
    const lg042 = await aMachine("LG-042");
    await aMaintenanceTask("Clean playfield", [lg042], { addedOn: "2026-06-03" });
    await aMaintenanceTask("Wax playfield", [lg042]);

    const { due } = await page("LG-042", "2026-06-10");

    const wax = entryOf(due, "Wax playfield");
    const clean = entryOf(due, "Clean playfield");
    expect(clean).toContain("fällig seit 03.06.2026");
    expect(clean).not.toContain("Überfällig");
    expect(wax).toContain("fällig seit 01.04.2026");
    expect(wax).toContain("Überfällig");
  });

  it("ST-047: Helpers record only maintenance suitable for helpers from the machine record", async () => {
    const lg042 = await aMachine("LG-042");
    await aMaintenanceTask("Clean glass (inside & out)", [lg042], { suitableForHelpers: true });
    await aMaintenanceTask("Check fuses, connectors, boards for burn marks", [lg042], { suitableForHelpers: false });

    const { due } = await page("LG-042", "2026-06-10", anna);

    expect(entryOf(due, "Clean glass (inside &amp; out)")).toContain(">Wartung erfassen<");
    expect(entryOf(due, "Check fuses, connectors, boards for burn marks")).toContain("fällig seit 01.04.2026");
    expect(entryOf(due, "Check fuses, connectors, boards for burn marks")).not.toContain("Wartung erfassen");
  });

  it("ST-047: Machines not on display show nothing due", async () => {
    const lg030 = await aMachine("LG-030");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg030], { addedOn: "2026-01-01" });
    await recorded(cleanGlass, lg030, "2026-03-15", { note: "Before the restoration" });
    await statusChanged(lg030, 0, "not-on-display", "2026-03-20");

    const { due, records } = await page("LG-030", "2026-10-01");

    expect(due).not.toContain("Clean glass");
    expect(due).not.toContain("fällig seit");
    expect(due).not.toContain("Überfällig");
    expect(due).toContain("Nicht ausgestellt – es wird keine Wartung fällig.");
    expect(records).toContain("Before the restoration");
  });

  it("says nothing due on a machine retired while Not on display, and still lists its records", async () => {
    const lg031 = await aMachine("LG-031");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg031], { addedOn: "2026-01-01" });
    await recorded(cleanGlass, lg031, "2026-03-15", { note: "Before the restoration" });
    await statusChanged(lg031, 0, "not-on-display", "2026-03-20");
    await run(
      executeCommand(
        retireMachineCommand,
        { machineId: lg031, version: 1, reason: "Sold to a collector" },
        { actor: tom, db, clock: fixedClock("2026-04-01T08:00:00Z"), newId: randomUUID },
      ),
    );

    const { due, records } = await page("LG-031", "2026-10-01");

    // A retired machine is not published for maintenance: nothing is due, and the header already says „Ausgemustert“.
    expect(due).toContain("Gerade ist an diesem Gerät keine Wartung fällig.");
    expect(due).not.toContain("Nicht ausgestellt");
    expect(records).toContain("Before the restoration");
  });

  it("ST-047: Nothing due and nothing recorded says so", async () => {
    await aMachine("LG-050");
    // The task applies to another machine only: on LG-050 nothing is due.
    await aMaintenanceTask("Clean glass (inside & out)", [await aMachine("LG-051")]);

    const { due, records } = await page("LG-050", "2026-06-10");

    expect(due).toContain("Gerade ist an diesem Gerät keine Wartung fällig.");
    expect(records).toContain("An diesem Gerät wurde noch keine Wartung eingetragen.");
  });

  it("shows the overdue maintenance tasks first, then the longest due", async () => {
    const lg042 = await aMachine("LG-042");
    await aMaintenanceTask("Due last", [lg042], { addedOn: "2026-06-08" });
    await aMaintenanceTask("Overdue", [lg042]);
    await aMaintenanceTask("Due first", [lg042], { addedOn: "2026-06-03" });

    const { due } = await page("LG-042", "2026-06-10");

    expect([...due.matchAll(/<p class="font-medium">([^<]+)<\/p>/g)].map(([, name]) => name)).toEqual([
      "Overdue",
      "Überfällig",
      "Due first",
      "Due last",
    ]);
  });

  it("groups all maintenance records by the year they were carried out, the newest first", async () => {
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042], { addedOn: "2025-01-01" });
    await recorded(cleanGlass, lg042, "2025-11-20", { note: "Glass of 2025-11-20" });
    await recorded(cleanGlass, lg042, "2026-02-03", { note: "Glass of 2026-02-03" });
    await recorded(cleanGlass, lg042, "2026-05-04", { note: "Glass of 2026-05-04" });

    const html = renderToStaticMarkup(
      createElement(MaintenanceRecordsView, {
        data: await loadAllMaintenanceRecords(db, "LG-042"),
        museumNumber: "LG-042",
      }),
    );

    expect(html.indexOf("2026 · 2 Einträge")).toBeLessThan(html.indexOf("Glass of 2026-05-04"));
    expect(html.indexOf("Glass of 2026-02-03")).toBeLessThan(html.indexOf("2025 · 1 Eintrag"));
    expect(html.indexOf("2025 · 1 Eintrag")).toBeLessThan(html.indexOf("Glass of 2025-11-20"));
  });

  it("confirms a maintenance record only on its own machine", async () => {
    const lg042 = await aMachine("LG-042");
    await aMachine("LG-043");
    const cleanGlass = await aMaintenanceTask("Clean glass (inside & out)", [lg042]);
    const { maintenanceRecordId } = await recorded(cleanGlass, lg042, "2026-06-10");
    const at = (address: string) => new URL(address, "https://laguardia.example");

    expect(
      (await pageAt(at(`/team/machines/LG-042?maintenanceRecorded=${maintenanceRecordId}`), "2026-06-10", tom)).html,
    ).toContain("Wartung an LG-042 eingetragen.");
    expect(
      (await pageAt(at(`/team/machines/LG-043?maintenanceRecorded=${maintenanceRecordId}`), "2026-06-10", tom)).html,
    ).not.toContain("Wartung an LG-04");
    expect(
      (await pageAt(at("/team/machines/LG-042?maintenanceRecorded=not-an-id"), "2026-06-10", tom)).html,
    ).not.toContain("Wartung an LG-04");
    // Only the team member who recorded it.
    expect(
      (await pageAt(at(`/team/machines/LG-042?maintenanceRecorded=${maintenanceRecordId}`), "2026-06-10", anna)).html,
    ).not.toContain("Wartung an LG-04");
  });

  describe("„Wartung erfassen“ from the machine record", () => {
    /** The form „Wartung erfassen“ opened from the machine record, through the runner, as that team member on that day. */
    function formOf(actor: Person, on: string) {
      const landedOn: string[] = [];
      const action = formRunner({
        currentPerson: async () => actor,
        db,
        clock: fixedClock(`${on}T10:00:00Z`),
        newId: randomUUID,
      })(
        recordMaintenanceCommand,
        recordMaintenanceDefinition(
          db,
          recordMaintenanceReturnOf("geraet"),
          async (address) => void landedOn.push(address),
        ),
      );
      return { action, landedOn };
    }

    it("ST-047: Recording maintenance from the machine record", async () => {
      const lg042 = await aMachine("LG-042");
      const cleanPlayfield = await aMaintenanceTask("Clean playfield", [lg042], {
        suitableForHelpers: true,
        addedOn: "2026-06-03",
      });
      const before = await page("LG-042", "2026-06-10", anna);
      expect(entryOf(before.due, "Clean playfield")).toContain(
        `href="/team/maintenance/erfassen?task=${cleanPlayfield}&amp;machine=LG-042&amp;von=geraet"`,
      );

      const { action, landedOn } = formOf(anna, "2026-06-10");
      expect(
        await action(null, post({ maintenanceTaskId: cleanPlayfield, machineId: lg042, outcome: "done", note: "" })),
      ).toBeNull();

      expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([
        expect.objectContaining({ maintenanceTaskId: cleanPlayfield, outcome: "done", recordedBy: anna.teamMemberId }),
      ]);
      const [address] = landedOn;
      const url = new URL(address, "https://laguardia.example");
      expect(url.pathname).toBe("/team/machines/LG-042");
      const after = await pageAt(url, "2026-06-10", anna);
      expect(after.html).toContain("Wartung an LG-042 eingetragen.");
      expect(after.due).not.toContain("Clean playfield");
    });

    it("ST-047: A rejected recording still leads back to the machine record", async () => {
      const lg042 = await aMachine("LG-042");
      const cleanPlayfield = await aMaintenanceTask("Clean playfield", [lg042], { addedOn: "2026-06-03" });
      const link = /href="([^"]*)"[^>]*>Wartung erfassen</.exec(
        entryOf((await page("LG-042", "2026-06-10")).due, "Clean playfield"),
      )![1];
      const opened = new URL(link.replaceAll("&amp;", "&"), "https://laguardia.example");
      const { action, landedOn } = formOf(tom, "2026-06-10");

      const state = await action(
        null,
        post({
          maintenanceTaskId: cleanPlayfield,
          machineId: lg042,
          outcome: "partially-done",
          date: "2026-06-02",
          note: "Only the left half",
        }),
      );

      expect(state).toMatchObject({
        error: "date-too-early",
        values: { outcome: "partially-done", note: "Only the left half" },
      });
      expect(landedOn).toEqual([]);
      expect(await maintenanceRecords(db, { machineId: lg042 })).toEqual([]);
      const data = await loadMaintenanceForRecording(db, fixedClock("2026-06-10T10:00:00Z"), cleanPlayfield, "LG-042", {
        id: tom.teamMemberId,
        role: tom.role,
      });
      // The form page as it is rendered again after the rejection – at the address the machine record opened.
      const back = recordMaintenanceReturnOf(opened.searchParams.get("von"));
      const html = renderToStaticMarkup(createElement(RecordMaintenancePage, { data: data!, back }));
      expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042"[^>]*>Zurück zum Gerät<\/a>/);
      expect(html).not.toContain("Zurück zur fälligen Wartung");
    });
  });
});

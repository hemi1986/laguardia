import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aMaintenanceTaskIn, removeMaintenanceTaskIn } from "@/test-support/maintenance";
import { formRunner } from "@/app/_actions/form-runner";
import { GroupedChoice } from "@/components/ui/grouped-choice";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import {
  changeMachinesOfMaintenanceTaskCommand,
  changeMaintenanceTasksOfMachineCommand,
  dueMaintenance,
  removedMaintenanceTaskNames,
} from "@/modules/maintenance";
import { maintenancePlanJournal, withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import type { Viewer } from "../../../claimant";
import { loadMachineConfirmation } from "../machine-confirmation";
import { MachineRecordView } from "../machine-record";
import { loadMachineRecord } from "../machine-record-data";
import { loadChangeTasks } from "./change-tasks-data";
import { ChangeTasksForm } from "./change-tasks-form";
import { changeTasksFields, changeTasksInput, SEEN_SEPARATOR, TASK_FIELD } from "./change-tasks-input";
import { tasksRejectionText } from "./tasks-rejection-text";

/**
 * „Wartungsaufgaben ändern“ from the page's side (ST-096, G27): the form page of one machine opens with the tasks that
 * apply to it ticked and every group closed, a form opened before another change still means what its technician
 * changed, a rejection keeps the choice, and the machine record confirms the result. In a database of its own, so an
 * empty maintenance plan and exact counts can be arranged.
 */
const isolated = isolatedTestDatabase("change_tasks_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
type Person = typeof tom | typeof eva | typeof anna;
let machineModelId: string;
const { changeTasks: texts, maintenancePlan: planTexts } = teamMessages;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Fireball", manufacturer: "Bally", machineCategory: "pinball", technology: "em" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!model.ok) throw new Error(model.error);
  machineModelId = model.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  await withoutMaintenanceTasks(db);
});

async function aMachine(museumNumber: string, machineStatus: "playable" | "not-on-display" = "playable") {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus },
    { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

/** A maintenance task, added on 1 March 2026, that applies to the given machines. */
async function aTask(name: string, machineIds: string[], { intervalMonths = 12, suitableForHelpers = false } = {}) {
  return aMaintenanceTaskIn(db, { name, machineIds, intervalMonths, suitableForHelpers, by: tom });
}

async function removeTask(maintenanceTaskId: string) {
  await removeMaintenanceTaskIn(db, maintenanceTaskId, { by: eva });
}

const tenthOfJune = fixedClock("2026-06-10T10:00:00Z");

/** The form page as the technician gets it: its markup, the headers of its groups and the tasks that apply now. */
async function formPage(museumNumber: string) {
  const { machine, groups, chosen } = await loadChangeTasks(db, museumNumber);
  const html = renderToStaticMarkup(createElement(ChangeTasksForm, { machineId: machine?.id ?? "", groups, chosen }));
  const headers = [...html.matchAll(/<summary[^>]*>(.*?)<\/summary>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, ""),
  );
  return { html, headers, chosen, machine };
}

/** The form as a technician sends it: the tasks they saw when the page opened, and those ticked now. */
async function send(machineId: string, seen: readonly string[], ticked: readonly string[], person: Person = tom) {
  const form = post({ machineId, seen: seen.join(SEEN_SEPARATOR) });
  for (const taskId of ticked) form.append(TASK_FIELD, taskId);
  return formRunner({ currentPerson: async () => person, db, clock: tenthOfJune, newId: randomUUID })(
    changeMaintenanceTasksOfMachineCommand,
    { fields: changeTasksFields, many: { field: TASK_FIELD }, input: changeTasksInput, onSuccess: async () => {} },
  )(null, form);
}

/** The tasks of the form as the page shows them again after a rejection: the groups as stored now, `chosen` ticked. */
async function choiceAfter(museumNumber: string, chosen: readonly string[]) {
  const { groups } = await loadChangeTasks(db, museumNumber);
  return renderToStaticMarkup(
    createElement(GroupedChoice, {
      name: TASK_FIELD,
      groups,
      chosen,
      header: planTexts.machines.groupHeader,
      selectAll: planTexts.machines.selectAll,
    }),
  );
}

/** The `<details>` of the group holding that task, and whether its checkbox is ticked. */
function groupOf(html: string, taskId: string) {
  const group = html.split("<details").find((part) => part.includes(`value="${taskId}"`))!;
  const box = group.match(new RegExp(`<input[^>]*value="${taskId}"[^>]*>`))![0];
  return { open: /^[^>]* open/.test(group), ticked: box.includes("checked") };
}

/** The machine record as that team member sees it – at the address the form leads to, with its confirmation (G3). */
async function recordPage(museumNumber: string, query: Record<string, string> = {}, person: Person = tom) {
  const viewer: Viewer = { id: person.teamMemberId, role: person.role };
  const record = await loadMachineRecord(db, museumNumber, { clock: tenthOfJune, viewer });
  const confirmation = record && (await loadMachineConfirmation(db, tenthOfJune, viewer.id, record, query));
  const html = renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber, confirmation }));
  const start = html.indexOf(">Wartung<");
  return {
    record,
    html,
    maintenance: html.slice(start, html.indexOf("<section", start) < 0 ? undefined : html.indexOf("<section", start)),
  };
}

const landing = (museumNumber: string) => recordPage(museumNumber, { tasksChanged: "1" });

describe("the form page „Wartungsaufgaben ändern“", () => {
  it("ST-096: A technician ticks a maintenance task for a machine", async () => {
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aTask("Clean glass (inside & out)", [lg042]);
    const waxPlayfield = await aTask("Wax playfield", [lg042]);
    const switchTest = await aTask("Switch test (every switch)", []);
    const dueBefore = (await dueMaintenance(db, tenthOfJune)).find((task) => task.id === cleanGlass)?.machines;

    // Opens „Wartungsaufgaben ändern“ on 10 June 2026, ticks the switch test as well and saves.
    const { chosen: seen } = await formPage("LG-042");
    expect(await send(lg042, seen, [...seen, switchTest])).toBeNull();

    const due = (await dueMaintenance(db, tenthOfJune)).find((task) => task.id === switchTest);
    expect(due?.machines.find((machine) => machine.machineId === lg042)?.dueSince).toBe("2026-06-10");
    expect((await loadChangeTasks(db, "LG-042")).chosen.sort()).toEqual([cleanGlass, waxPlayfield, switchTest].sort());
    const { html } = await landing("LG-042");
    expect(html).toContain("Für LG-042 gelten jetzt 3 Wartungsaufgaben.");
    // The tasks that applied before keep their due dates.
    expect((await dueMaintenance(db, tenthOfJune)).find((task) => task.id === cleanGlass)?.machines).toEqual(dueBefore);
  });

  it("ST-096: The section says how many tasks apply", async () => {
    const [lg042, lg043] = [await aMachine("LG-042"), await aMachine("LG-043")];
    await aMachine("LG-044");
    for (const name of ["Clean glass", "Wax playfield", "Switch test", "Check flippers"]) await aTask(name, [lg042]);
    await aTask("Oil the gum machine", [lg043]);

    const [first, second, third] = [await recordPage("LG-042"), await recordPage("LG-043"), await recordPage("LG-044")];

    expect(first.maintenance).toContain("Für dieses Gerät gelten 4 Wartungsaufgaben.");
    expect(second.maintenance).toContain("Für dieses Gerät gilt 1 Wartungsaufgabe.");
    expect(third.maintenance).toContain("Für dieses Gerät gilt keine Wartungsaufgabe.");
    for (const { maintenance } of [first, second, third]) {
      expect(maintenance).toContain(">Wartungsaufgaben ändern<");
    }
    expect(first.maintenance).toContain('href="/team/machines/LG-042/wartungsaufgaben-aendern"');
  });

  it("ST-096: The tasks are grouped by interval, the applying ones ticked", async () => {
    const lg042 = await aMachine("LG-042");
    const monthly = [];
    for (const name of ["Monthly E", "Monthly A", "Monthly D", "Monthly B", "Monthly C"]) {
      monthly.push(await aTask(name, [], { intervalMonths: 1, suitableForHelpers: name === "Monthly A" }));
    }
    const [monthlyE, monthlyA] = [monthly[0], monthly[1]];
    const quarterly = [];
    for (const name of ["Quarterly 1", "Quarterly 2", "Quarterly 3", "Quarterly 4"]) {
      quarterly.push(await aTask(name, [], { intervalMonths: 3 }));
    }
    await aTask("Yearly", [], { intervalMonths: 12 });
    // Two of the monthly tasks and one of the quarterly tasks apply to LG-042.
    expect(await send(lg042, [], [monthlyE, monthlyA, quarterly[0]])).toBeNull();

    const { html, headers, machine } = await formPage("LG-042");
    const heading = renderToStaticMarkup(createElement("h1", null, texts.title(machine!.museumNumber)));

    expect(heading).toContain("Wartungsaufgaben ändern · LG-042");
    expect(headers).toEqual([
      "Jeden Monat – 2 von 5 ausgewählt",
      "Alle 3 Monate – 1 von 4 ausgewählt",
      "Alle 12 Monate – 0 von 1 ausgewählt",
    ]);
    expect(html).not.toMatch(/<details[^>]* open/);
    // Opening „Jeden Monat“ shows its tasks ordered by name, the two applying ones ticked.
    const names = [...html.split("<details")[1].matchAll(/Monthly [A-E]/g)].map(([name]) => name);
    expect(names).toEqual(["Monthly A", "Monthly B", "Monthly C", "Monthly D", "Monthly E"]);
    expect(groupOf(html, monthlyE).ticked).toBe(true);
    expect(groupOf(html, monthlyA).ticked).toBe(true);
    expect(groupOf(html, monthly[2]).ticked).toBe(false);
    expect(html).toContain(`name="seen" value="`);
    expect(html.split("<details")[1]).toContain("Monthly A · Für Helfer:innen geeignet");
  });

  it("ST-096: A task removed meanwhile rejects the whole change", async () => {
    const lg042 = await aMachine("LG-042");
    const cleanGlass = await aTask("Clean glass (inside & out)", [lg042]);
    const waxPlayfield = await aTask("Wax playfield", []);
    const switchTest = await aTask("Switch test (every switch)", [], { intervalMonths: 3 });
    // The technician opened the form, unticked Clean glass, ticked Wax playfield and the switch test …
    const { chosen: seen } = await formPage("LG-042");
    // … and another technician removed Wax playfield from the maintenance plan a moment ago.
    await removeTask(waxPlayfield);

    const state = await send(lg042, seen, [waxPlayfield, switchTest]);

    expect(state).toMatchObject({ error: "maintenance-task-removed", chosen: [waxPlayfield, switchTest] });
    const removed = await removedMaintenanceTaskNames(
      db,
      state!.chosen.filter((maintenanceTaskId) => !seen.includes(maintenanceTaskId)),
    );
    expect(removed).toEqual(["Wax playfield"]);
    expect(tasksRejectionText({ error: state!.error, removed })).toBe(
      "„Wax playfield“ ist nicht mehr im Wartungsplan. Es wurde nichts gespeichert.",
    );
    // Clean glass still applies; Wax playfield is no longer offered, the other tick is kept and its group open.
    expect((await loadChangeTasks(db, "LG-042")).chosen).toEqual([cleanGlass]);
    const choice = await choiceAfter("LG-042", state!.chosen);
    expect(choice).not.toContain("Wax playfield");
    expect(groupOf(choice, switchTest)).toEqual({ open: true, ticked: true });
  });

  it("ST-096: Saving without a change is confirmed", async () => {
    const lg042 = await aMachine("LG-042");
    await aTask("Clean glass (inside & out)", [lg042]);
    await aTask("Wax playfield", [lg042]);
    const { chosen } = await formPage("LG-042");
    const eventsBefore = (await maintenancePlanJournal(db)).length;

    expect(await send(lg042, chosen, chosen)).toBeNull();

    expect(await maintenancePlanJournal(db)).toHaveLength(eventsBefore);
    expect((await landing("LG-042")).html).toContain("Für LG-042 gelten jetzt 2 Wartungsaufgaben.");
  });

  it("ST-096: Unticking the last task is confirmed in words", async () => {
    const lg042 = await aMachine("LG-042");
    await aTask("Wax playfield", [lg042]);
    const { chosen } = await formPage("LG-042");

    expect(await send(lg042, chosen, [])).toBeNull();

    const { html, maintenance } = await landing("LG-042");
    expect(html).toContain("Für LG-042 gilt jetzt keine Wartungsaufgabe.");
    expect(maintenance).toContain("Für dieses Gerät gilt keine Wartungsaufgabe.");
  });

  it("ST-096: An empty maintenance plan says so", async () => {
    await aMachine("LG-042");

    const { html } = await formPage("LG-042");

    expect(html).toContain("Noch keine Wartungsaufgabe im Wartungsplan.");
    expect(html).toContain('href="/team/maintenance-plan"');
    expect(html).not.toContain("<form");
  });

  it("ST-096: A retired machine's tasks cannot be changed", async () => {
    const lg013 = await aMachine("LG-013");
    const waxPlayfield = await aTask("Wax playfield", []);
    await retireMachine(db, lg013);

    const { maintenance } = await recordPage("LG-013");
    const state = await send(lg013, [], [waxPlayfield]);

    expect(maintenance).not.toContain("Wartungsaufgaben ändern");
    expect(state).toMatchObject({ error: "machine-retired" });
    expect((await loadChangeTasks(db, "LG-013")).machine?.retired).toBe(true);
  });

  it("ST-096: Helpers do not change a machine's maintenance tasks", async () => {
    const lg042 = await aMachine("LG-042");
    const waxPlayfield = await aTask("Wax playfield", []);

    const { maintenance } = await recordPage("LG-042", {}, anna);
    const state = await send(lg042, [], [waxPlayfield], anna);

    // Helpers see the sentence, not the button.
    expect(maintenance).toContain("Für dieses Gerät gilt keine Wartungsaufgabe.");
    expect(maintenance).not.toContain("Wartungsaufgaben ändern");
    expect(state).toMatchObject({ error: "not-authorized" });
  });

  it("a form opened before another change still means what its technician changed", async () => {
    const lg042 = await aMachine("LG-042");
    const waxPlayfield = await aTask("Wax playfield", [lg042]);
    const cleanGlass = await aTask("Clean glass (inside & out)", []);
    const { chosen: seenByTom } = await formPage("LG-042");
    const removed = await executeCommand(
      changeMachinesOfMaintenanceTaskCommand,
      { maintenanceTaskId: waxPlayfield, seen: [lg042], ticked: [] },
      { actor: eva, db, clock: tenthOfJune, newId: randomUUID },
    );
    expect(removed).toMatchObject({ ok: true });

    expect(await send(lg042, seenByTom, [waxPlayfield, cleanGlass])).toBeNull();

    expect((await loadChangeTasks(db, "LG-042")).chosen).toEqual([cleanGlass]);
  });

  it("a rejection keeps what was seen when the page opened", async () => {
    const lg042 = await aMachine("LG-042");
    const waxPlayfield = await aTask("Wax playfield", [lg042]);

    const state = await send(lg042, [waxPlayfield], [randomUUID()]);

    expect(state).toMatchObject({ error: "maintenance-task-unknown", values: { seen: waxPlayfield } });
    expect(tasksRejectionText({ error: state!.error })).toBe(
      "Diese Wartungsaufgabe gibt es nicht. Es wurde nichts gespeichert.",
    );
  });
});

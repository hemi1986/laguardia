import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aMaintenanceTaskIn } from "@/test-support/maintenance";
import { formRunner } from "@/app/_actions/form-runner";
import { createMachineModelCommand, registerMachineCommand, type MachineStatus } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import {
  changeMachinesOfMaintenanceTaskCommand,
  dueMaintenance,
  maintenancePlan,
  maintenancePlanVersion,
} from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { GroupedChoice } from "@/components/ui/grouped-choice";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { MaintenancePlanView } from "../../maintenance-plan";
import { loadMaintenancePlan } from "../../maintenance-plan-data";
import { machinesRejectionText } from "../../machines-rejection-text";
import { withRetiredNamed } from "../../retired-named";
import { loadChangeMachines } from "./change-machines-data";
import { ChangeMachinesForm } from "./change-machines-form";
import { SEEN_FIELD, seenValue } from "@/app/_actions/form-parts";
import { changeMachinesDefinition, machinesChangedLanding, MACHINE_FIELD } from "./change-machines-input";

/**
 * „Geräte ändern“ from the page's side (ST-095, G27): the form page opens with the machines of the task ticked and every
 * group closed, a form opened before another change still means what its technician changed, a rejection keeps the
 * choice, and the plan confirms the result. In a database of its own, so "no machine registered yet" and exact counts can
 * be arranged.
 */
const isolated = isolatedTestDatabase("change_machines_page");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let machineModelId: string;
const { maintenancePlan: texts } = teamMessages;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
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

/** A machine with that museum number. */
async function aMachine(museumNumber: string, machineStatus: MachineStatus = "playable") {
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus,
    },
    { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

/** A maintenance task that applies to the given machines. */
async function aTask(name: string, machineIds: string[]) {
  return aMaintenanceTaskIn(db, { name, machineIds, by: tom });
}

/** The form page as the technician gets it: its markup, and the headers of its groups. */
async function formPage(maintenanceTaskId: string) {
  const { task, groups, chosen } = await loadChangeMachines(db, maintenanceTaskId);
  const html = renderToStaticMarkup(
    createElement(ChangeMachinesForm, { maintenanceTaskId, groups, chosen, removed: task?.removed ?? true }),
  );
  const headers = [...html.matchAll(/<summary[^>]*>(.*?)<\/summary>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, ""),
  );
  return { html, headers, chosen, task };
}

/** The form as a technician sends it: what they saw when the page opened, and what is ticked now. */
async function send(maintenanceTaskId: string, seen: readonly string[], ticked: readonly string[], person = tom) {
  const form = post({ maintenanceTaskId, [SEEN_FIELD]: seenValue(seen) });
  for (const machineId of ticked) form.append(MACHINE_FIELD, machineId);
  return formRunner({
    currentPerson: async () => person,
    db,
    clock: fixedClock("2026-06-10T10:00:00Z"),
    newId: randomUUID,
  })(changeMachinesOfMaintenanceTaskCommand, { ...changeMachinesDefinition, onSuccess: async () => {} })(null, form);
}

/** The choice as the form shows it again after a rejection: the groups as stored now, `chosen` ticked. */
async function choiceAfter(maintenanceTaskId: string, chosen: readonly string[]) {
  const { groups } = await loadChangeMachines(db, maintenanceTaskId);
  return renderToStaticMarkup(
    createElement(GroupedChoice, {
      name: MACHINE_FIELD,
      groups,
      chosen,
      header: texts.machines.groupHeader,
      selectAll: texts.machines.selectAll,
    }),
  );
}

/** The `<details>` of the group holding that machine, and whether its checkbox is ticked. */
function groupOf(html: string, machineId: string) {
  const group = html.split("<details").find((part) => part.includes(`value="${machineId}"`))!;
  const box = group.match(new RegExp(`<input[^>]*value="${machineId}"[^>]*>`))![0];
  return { open: /^[^>]* open/.test(group), ticked: box.includes("checked") };
}

const landing = async (maintenanceTaskId: string) =>
  renderToStaticMarkup(
    createElement(
      MaintenancePlanView,
      await loadMaintenancePlan(db, tom.teamMemberId, { machinesChanged: maintenanceTaskId }),
    ),
  );

const tenthOfJune = fixedClock("2026-06-10T10:00:00Z");

describe("the form page „Geräte ändern“", () => {
  it("ST-095: A technician adds a machine to a maintenance task", async () => {
    const [lg005, lg042, lg043] = [await aMachine("LG-005"), await aMachine("LG-042"), await aMachine("LG-043")];
    const task = await aTask("Clean glass (inside & out)", [lg005, lg042]);

    // Opens „Geräte ändern“, ticks LG-043 as well and sends the change on 10 June 2026.
    const seen = (await loadChangeMachines(db, task)).chosen;
    expect(await send(task, seen, [...seen, lg043])).toBeNull();

    expect((await loadChangeMachines(db, task)).chosen).toEqual([lg005, lg042, lg043]);
    const due = (await dueMaintenance(db, tenthOfJune)).find((each) => each.id === task);
    expect(due?.machines.find((machine) => machine.machineId === lg043)?.dueSince).toBe("2026-06-10");
    const html = await landing(task);
    expect(html).toContain("„Clean glass (inside &amp; out)“ gilt jetzt für 3 Geräte.");
    expect(html).toContain("Gilt für 3 Geräte");
  });

  it("ST-095: The machines the task applies to are ticked, the groups closed", async () => {
    const machines = [];
    for (const museumNumber of ["LG-005", "LG-006", "LG-007", "LG-008", "LG-009", "LG-010"])
      machines.push(await aMachine(museumNumber));
    const task = await aTask("Clean glass (inside & out)", machines.slice(0, 4));

    const { html, headers, chosen } = await formPage(task);

    expect(headers).toEqual(["Flipper · EM – 4 von 6 ausgewählt"]);
    expect(html).not.toMatch(/<details[^>]* open/);
    // Opening the group shows those 4 machines ticked, and no other.
    for (const [index, machineId] of machines.entries()) expect(groupOf(html, machineId).ticked).toBe(index < 4);
    // What the form posts as seen: the 4, to tell later what the technician changed.
    expect(chosen).toEqual(machines.slice(0, 4));
    expect(html).toContain(`name="${SEEN_FIELD}" value="${seenValue(machines.slice(0, 4))}"`);
  });

  it("ST-095: A form opened before another change does not undo it", async () => {
    const [lg005, lg042, lg043] = [await aMachine("LG-005"), await aMachine("LG-042"), await aMachine("LG-043")];
    const task = await aTask("Wax playfield", [lg005, lg042]);
    // Tom opens „Geräte ändern“: LG-005 and LG-042 are ticked.
    const seenByTom = (await loadChangeMachines(db, task)).chosen;
    expect(seenByTom).toEqual([lg005, lg042]);
    // Eva then adds LG-043 and removes LG-042.
    expect(await send(task, [lg005, lg042], [lg005, lg043], eva)).toBeNull();

    // Tom unticks LG-005, leaves LG-042 ticked as it was, and sends the change.
    const outcome = await send(task, seenByTom, [lg042]);

    expect(outcome).toBeNull(); // nothing is rejected
    const { chosen } = await loadChangeMachines(db, task);
    expect(chosen).toEqual([lg043]);
    expect((await maintenancePlan(db)).maintenanceTasks.find((each) => each.id === task)?.machineCount).toBe(1);
  });

  it("ST-095: A machine retired meanwhile rejects the change", async () => {
    const [lg043, lg044] = [await aMachine("LG-043"), await aMachine("LG-044")];
    const task = await aTask("Clean glass (inside & out)", []);
    const seen = (await loadChangeMachines(db, task)).chosen;
    await retireMachine(db, lg044);

    const state = await send(task, seen, [lg043, lg044]);

    expect(state).toMatchObject({ error: "machine-retired", chosen: [lg043, lg044], seen: [], subjects: [lg044] });
    // What the Server Action adds: the machines the decision named, by their museum numbers.
    const named = await withRetiredNamed(db, state);
    expect(named?.retired).toEqual(["LG-044"]);
    expect(machinesRejectionText(named!)).toBe("LG-044 ist inzwischen ausgemustert. Es wurde nichts gespeichert.");
    // Nothing is stored; LG-044 is no longer offered, while LG-043 stays ticked and its group is open. (The static
    // render of the whole form has no action state, so the open group is checked on the choice the form renders with
    // `openWithChoice` after a rejection; the browser tests cover the form itself.)
    expect((await loadChangeMachines(db, task)).chosen).toEqual([]);
    const choice = await choiceAfter(task, state!.chosen);
    expect(choice).not.toContain("LG-044");
    expect(groupOf(choice, lg043)).toEqual({ open: true, ticked: true });
  });

  it("lands on the maintenance plan, which confirms the task the command names", async () => {
    const task = await aTask("Wax playfield", []);
    const sent = await send(task, [], []);

    expect(sent).toBeNull();
    expect(machinesChangedLanding({ maintenanceTaskId: task })).toBe(`/team/maintenance-plan?machinesChanged=${task}`);
  });

  it("ST-095: No machine registered yet", async () => {
    const task = await aTask("Wax playfield", []);
    await retireMachine(db, await aMachine("LG-013"));

    const { html, headers } = await formPage(task);

    expect(headers).toEqual([]);
    expect(html).toContain("Noch kein Gerät erfasst.");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/new"[^>]*>Gerät erfassen<\/a>/);
    expect(html).not.toContain("<form");
  });
});

describe("back on the maintenance plan", () => {
  it("ST-095: A change that changes nothing records nothing and is confirmed", async () => {
    const [lg005, lg042] = [await aMachine("LG-005"), await aMachine("LG-042")];
    const task = await aTask("Clean glass (inside & out)", [lg005, lg042]);
    const version = await maintenancePlanVersion(db);
    const dueBefore = (await dueMaintenance(db, tenthOfJune)).find((each) => each.id === task);

    const outcome = await send(task, [lg005, lg042], [lg005, lg042]);

    expect(outcome).toBeNull();
    expect(await maintenancePlanVersion(db)).toBe(version); // nothing was recorded
    // The due dates of LG-005 and LG-042 stay as they were.
    expect((await dueMaintenance(db, tenthOfJune)).find((each) => each.id === task)).toEqual(dueBefore);
    expect(dueBefore?.machines.map((machine) => machine.dueSince)).toEqual(["2026-03-01", "2026-03-01"]);
    const html = await landing(task);
    expect(html).toContain("„Clean glass (inside &amp; out)“ gilt jetzt für 2 Geräte.");
    expect(html).toContain("Gilt für 2 Geräte");
  });

  it("ST-095: Removing every machine leaves the task for no machine", async () => {
    const lg090 = await aMachine("LG-090");
    const task = await aTask("Oil the gum machine", [lg090]);

    expect(await send(task, [lg090], [])).toBeNull();

    const html = await landing(task);
    expect(html).toContain("„Oil the gum machine“ gilt jetzt für kein Gerät.");
    expect(html).toContain("Gilt für kein Gerät");
  });

  it("an address that names no task of the plan confirms nothing", async () => {
    await aTask("Wax playfield", []);
    const html = renderToStaticMarkup(
      createElement(
        MaintenancePlanView,
        await loadMaintenancePlan(db, tom.teamMemberId, { machinesChanged: randomUUID() }),
      ),
    );
    expect(html).not.toContain("gilt jetzt");
    expect(html).toContain("Wax playfield");
  });
});

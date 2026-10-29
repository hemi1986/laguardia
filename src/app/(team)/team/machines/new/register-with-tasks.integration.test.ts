import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { GroupedChoice } from "@/components/ui/grouped-choice";
import {
  changeMachineStatusCommand,
  createMachineModelCommand,
  machineForTeamForm,
  machineIdOf,
  registerMachineCommand,
  type MachineCategory,
  type MachineStatus,
  type Technology,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { dueMaintenance, registerMachineWithMaintenanceTasksCommand } from "@/modules/maintenance";
import { maintenancePlanJournal, withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { retireMachine } from "@/test-support/machines";
import { aMaintenanceTaskIn, removeMaintenanceTaskIn } from "@/test-support/maintenance";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadChangeTasks } from "../[museumNumber]/wartungsaufgaben-aendern/change-tasks-data";
import { withRemovedNamed } from "../task-choice";
import { tasksRejectionText } from "../tasks-rejection-text";
import { loadRegistration } from "./register-machine-data";
import { RegisterMachineForm } from "./register-machine-form";
import { registerMachineDefinition } from "./register-machine-input";
import { TASK_FIELD } from "./task-field";

/**
 * Registering a machine with its maintenance tasks from the page's side (ST-097, HS-22): what the form posts goes through
 * the runner to CMD-RegisterMachine with Maintenance's POL-RegistrationAppliesChosenMaintenanceTasks – the machine and its
 * tasks stored together or not at all –, and the page's data says what each machine model proposes. Ticking with
 * JavaScript is the browser's (`e2e/register-machine-maintenance.spec.ts`). In a database of its own, so an empty plan,
 * museum numbers and exact proposals can be arranged.
 */
const isolated = isolatedTestDatabase("register_with_tasks");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
type Person = typeof tom | typeof eva | typeof anna;
const models: Record<"medievalMadness" | "fireball" | "galaxian", string> = {
  medievalMadness: "",
  fireball: "",
  galaxian: "",
};
const { maintenancePlan: planTexts } = teamMessages;

async function aModel(title: string, machineCategory: MachineCategory, technology: Technology | undefined) {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", machineCategory, technology },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
  models.medievalMadness = await aModel("Medieval Madness", "pinball", "dmd");
  models.fireball = await aModel("Fireball", "pinball", "em");
  models.galaxian = await aModel("Galaxian", "arcade", "crt");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  await withoutMachines(db);
  await withoutMaintenanceTasks(db);
});

const tenthOfJune = fixedClock("2026-06-10T10:00:00Z");

/** A machine registered before the story – through Collection's own command, with no task chosen. */
async function aMachine(museumNumber: string, machineModelId: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

/** A maintenance task, added on 1 March 2026, that applies to the given machines. */
async function aTask(name: string, machineIds: string[] = [], intervalMonths = 12) {
  return aMaintenanceTaskIn(db, { name, machineIds, intervalMonths, by: tom });
}

/** The registration form as a technician sends it – the machine's fields and the maintenance tasks ticked. */
async function register(
  {
    machineModelId = models.medievalMadness,
    museumNumber = "",
    location = "Hall 2, row 3",
    machineStatus = "playable",
  }: { machineModelId?: string; museumNumber?: string; location?: string; machineStatus?: MachineStatus },
  ticked: readonly string[],
  { person = tom, clock = tenthOfJune }: { person?: Person; clock?: ReturnType<typeof fixedClock> } = {},
) {
  const form = post({ machineModelId, museumNumber, serialNumber: "", location, machineStatus });
  for (const taskId of ticked) form.append(TASK_FIELD, taskId);
  return formRunner({ currentPerson: async () => person, db, clock, newId: randomUUID })(
    registerMachineWithMaintenanceTasksCommand,
    { ...registerMachineDefinition, onSuccess: async () => {} },
  )(null, form);
}

/** The maintenance tasks that apply to a machine, by museum number – as its form „Wartungsaufgaben ändern“ ticks them. */
const tasksOf = async (museumNumber: string) => (await loadChangeTasks(db, museumNumber)).chosen;

/** The due machine of a task with that museum number, on the given day. */
async function dueOn(clock: ReturnType<typeof fixedClock>, maintenanceTaskId: string, museumNumber: string) {
  const task = (await dueMaintenance(db, clock)).find((due) => due.id === maintenanceTaskId);
  return task?.machines.find((machine) => machine.museumNumber === museumNumber);
}

/** The maintenance tasks of the form after a rejection: the groups as stored now, `chosen` ticked. */
async function choiceAfter(chosen: readonly string[]) {
  const { tasks } = await loadRegistration(db);
  return renderToStaticMarkup(
    createElement(GroupedChoice, {
      name: TASK_FIELD,
      groups: tasks,
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

describe("registering a machine with its maintenance tasks", () => {
  it("ST-097: A machine is registered with its maintenance tasks", async () => {
    const cleanGlass = await aTask("Clean glass (inside & out)");
    const waxPlayfield = await aTask("Wax playfield");

    // A technician registers a machine of Medieval Madness at "Hall 2, row 3", Playable, on 10 June 2026.
    expect(await register({ museumNumber: "LG-042" }, [cleanGlass])).toBeNull();

    const lg042 = await machineIdOf(db, "LG-042");
    expect(lg042).toBeDefined();
    expect((await dueOn(tenthOfJune, cleanGlass, "LG-042"))?.dueSince).toBe("2026-06-10");
    expect(await tasksOf("LG-042")).toEqual([cleanGlass]);
    expect(await tasksOf("LG-042")).not.toContain(waxPlayfield);
    // The change of the machines of Clean glass names the registering technician.
    const change = (await maintenancePlanJournal(db)).at(-1)!;
    expect(change).toMatchObject({
      type: "EVT-MachinesOfMaintenanceTaskChanged",
      actor: tom,
      data: { maintenanceTaskId: cleanGlass, machinesAdded: [lg042], machinesRemoved: [] },
    });
  });

  it("ST-097: A machine can be registered without maintenance tasks", async () => {
    await aTask("Clean glass (inside & out)");
    const eventsBefore = (await maintenancePlanJournal(db)).length;

    expect(await register({ museumNumber: "LG-043" }, [])).toBeNull();

    expect(await machineIdOf(db, "LG-043")).toBeDefined();
    expect(await tasksOf("LG-043")).toEqual([]);
    expect(await maintenancePlanJournal(db)).toHaveLength(eventsBefore);
  });

  it("ST-097: A machine registered as not on display becomes due on its return", async () => {
    const cleanPlayfield = await aTask("Clean playfield");

    expect(await register({ museumNumber: "LG-030", machineStatus: "not-on-display" }, [cleanPlayfield])).toBeNull();

    expect(await tasksOf("LG-030")).toEqual([cleanPlayfield]);
    expect(await dueOn(tenthOfJune, cleanPlayfield, "LG-030")).toBeUndefined();
    // LG-030 returns to display on 20 June 2026.
    const machine = await machineForTeamForm(db, "LG-030");
    const returned = await executeCommand(
      changeMachineStatusCommand,
      { machineId: machine!.id, version: machine!.version, machineStatus: "playable", reason: "Restored" },
      { actor: tom, db, clock: fixedClock("2026-06-20T09:00:00Z"), newId: randomUUID },
    );
    expect(returned.ok).toBe(true);
    expect((await dueOn(fixedClock("2026-06-20T12:00:00Z"), cleanPlayfield, "LG-030"))?.dueSince).toBe("2026-06-20");
  });

  it("ST-097: A task removed meanwhile rejects the whole registration", async () => {
    const waxPlayfield = await aTask("Wax playfield", [], 1);
    const cleanGlass = await aTask("Clean glass (inside & out)", [], 1);
    const eventsBefore = (await maintenancePlanJournal(db)).length;
    // The technician ticked both; another technician removed Wax playfield from the maintenance plan a moment ago.
    await removeMaintenanceTaskIn(db, waxPlayfield, { by: eva });

    const state = await register(
      { museumNumber: "LG-042", machineModelId: models.fireball, machineStatus: "limited" },
      [waxPlayfield, cleanGlass],
    );

    expect(state).toMatchObject({ error: "maintenance-task-removed", subjects: [waxPlayfield] });
    const named = await withRemovedNamed(db, state);
    expect(tasksRejectionText(named!)).toBe(
      "„Wax playfield“ ist nicht mehr im Wartungsplan. Es wurde nichts gespeichert.",
    );
    // No machine is registered, and the plan changed by nothing but the removal.
    expect(await machineIdOf(db, "LG-042")).toBeUndefined();
    expect(await maintenancePlanJournal(db)).toHaveLength(eventsBefore + 1);
    // Wax playfield is no longer offered, Clean glass is still ticked – its group open.
    const choice = await choiceAfter(state!.chosen);
    expect(choice).not.toContain("Wax playfield");
    expect(groupOf(choice, cleanGlass)).toEqual({ open: true, ticked: true });
    // The machine model, the location and the machine status are still filled in.
    expect(state!.values).toMatchObject({
      machineModelId: models.fireball,
      location: "Hall 2, row 3",
      machineStatus: "limited",
    });
  });

  it("ST-097: An unknown maintenance task in a forged registration rejects it", async () => {
    const cleanGlass = await aTask("Clean glass (inside & out)");
    const eventsBefore = (await maintenancePlanJournal(db)).length;

    const state = await register({ museumNumber: "LG-042" }, [cleanGlass, randomUUID()]);

    expect(state).toMatchObject({ error: "maintenance-task-unknown" });
    expect(tasksRejectionText(state!)).toBe("Diese Wartungsaufgabe gibt es nicht. Es wurde nichts gespeichert.");
    expect(await machineIdOf(db, "LG-042")).toBeUndefined();
    expect(await maintenancePlanJournal(db)).toHaveLength(eventsBefore);
  });

  it("a rejection of the registration itself runs no policy – nothing applies to a new machine", async () => {
    const cleanGlass = await aTask("Clean glass (inside & out)");
    const eventsBefore = (await maintenancePlanJournal(db)).length;

    const state = await register({ museumNumber: "42" }, [cleanGlass]);

    expect(state).toMatchObject({ error: "museum-number-format", chosen: [cleanGlass] });
    expect(await maintenancePlanJournal(db)).toHaveLength(eventsBefore);
  });

  it("a task chosen twice in a forged registration rejects it", async () => {
    const cleanGlass = await aTask("Clean glass (inside & out)");

    expect(await register({ museumNumber: "LG-042" }, [cleanGlass, cleanGlass])).toMatchObject({
      error: "maintenance-task-chosen-twice",
    });
    expect(await machineIdOf(db, "LG-042")).toBeUndefined();
  });

  it("a helper's registration with maintenance tasks is rejected and changes nothing", async () => {
    const cleanGlass = await aTask("Clean glass (inside & out)");
    const eventsBefore = (await maintenancePlanJournal(db)).length;

    expect(await register({ museumNumber: "LG-042" }, [cleanGlass], { person: anna })).toMatchObject({
      error: "not-authorized",
    });
    expect(await machineIdOf(db, "LG-042")).toBeUndefined();
    expect(await maintenancePlanJournal(db)).toHaveLength(eventsBefore);
  });
});

describe("the registration form's maintenance tasks", () => {
  it("ST-097: A task that applies only to retired machines is not proposed", async () => {
    const lg007 = await aMachine("LG-007", models.fireball);
    const adjustSteppers = await aTask("Adjust stepper units", [lg007]);
    await retireMachine(db, lg007);

    const { tasks, proposals } = await loadRegistration(db);

    // Offered …
    expect(tasks.flatMap((group) => group.entries.map((entry) => entry.value))).toContain(adjustSteppers);
    // … but not proposed for an EM pinball machine model.
    expect(proposals[models.fireball]).toBeUndefined();
  });

  it("proposes the tasks of machines of the same machine category and technology, and says why", async () => {
    const lg005 = await aMachine("LG-005", models.fireball);
    const lg010 = await aMachine("LG-010", models.galaxian);
    const scoreReels = await aTask("Clean & adjust score reels / stepper units", [lg005]);
    const waxPlayfield = await aTask("Wax playfield", [lg005], 6);
    const cleanGlass = await aTask("Clean glass (inside & out)", [lg005], 1);
    const joysticks = await aTask("Test joysticks, buttons, coin door", [lg010]);

    const { proposals } = await loadRegistration(db);

    // In the order the form shows them: by interval, then by name.
    expect(proposals[models.fireball]).toEqual({
      tasks: [cleanGlass, waxPlayfield, scoreReels],
      line: "Vorgeschlagen: 3 Wartungsaufgaben, die schon für Geräte mit Flipper · EM gelten.",
    });
    expect(proposals[models.galaxian]).toEqual({
      tasks: [joysticks],
      line: "Vorgeschlagen: 1 Wartungsaufgabe, die schon für Geräte mit Arcade · CRT gilt.",
    });
    // A DMD pinball machine is another kind of machine: nothing to propose.
    expect(proposals[models.medievalMadness]).toBeUndefined();
  });

  it("the form offers every task in groups, none ticked, with no proposal line before a model is chosen", async () => {
    await aTask("Clean glass (inside & out)", [await aMachine("LG-005", models.fireball)], 1);
    await aTask("Wax playfield", [], 6);

    const html = renderToStaticMarkup(createElement(RegisterMachineForm, await loadRegistration(db)));

    expect(html).toContain("<legend");
    expect(html).toContain(">Wartungsaufgaben</legend>");
    const headers = [...html.matchAll(/<summary[^>]*>(.*?)<\/summary>/g)].map((match) =>
      match[1].replace(/<[^>]+>/g, ""),
    );
    expect(headers).toEqual(["Jeden Monat – 0 von 1 ausgewählt", "Alle 6 Monate – 0 von 1 ausgewählt"]);
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).not.toMatch(/<input[^>]* checked/);
    expect(html).not.toContain("Vorgeschlagen");
    // The section comes after the machine's own fields and before the button.
    expect(html.indexOf('name="machineStatus"')).toBeLessThan(html.indexOf(">Wartungsaufgaben<"));
    expect(html.indexOf(">Wartungsaufgaben<")).toBeLessThan(html.indexOf('type="submit"'));
  });

  it("ST-097: An empty maintenance plan says so on the registration form", async () => {
    const html = renderToStaticMarkup(createElement(RegisterMachineForm, await loadRegistration(db)));

    expect(html).toContain(">Wartungsaufgaben</legend>");
    expect(html).toContain("Noch keine Wartungsaufgabe im Wartungsplan.");
    // The machine can be registered all the same.
    expect(await register({ museumNumber: "LG-042" }, [])).toBeNull();
    expect(await machineIdOf(db, "LG-042")).toBeDefined();
  });
});

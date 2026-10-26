import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createMachineModelCommand,
  registerMachineCommand,
  type MachineCategory,
  type MachineStatus,
  type Technology,
} from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { changeMaintenancePlanCommand, maintenancePlan } from "@/modules/maintenance";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { MaintenancePlanView } from "../maintenance-plan";
import { AddMaintenanceTaskForm } from "./add-maintenance-task-form";
import { loadAddMaintenanceTask } from "./add-maintenance-task-data";
import { retiredAmong } from "./retired-among";

/**
 * The machines „Wartungsaufgabe hinzufügen“ offers (RM-MachineChoiceForMaintenanceTask, ST-094, G27): in groups by
 * machine category and technology, closed when the form opens. In a database of its own, so "no Solid-State or LCD
 * machine" and exact counts can be arranged.
 */
const isolated = isolatedTestDatabase("maintenance_machine_choice");
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

/** A machine model of that title, machine category and technology, once. */
async function modelOf(title: string, machineCategory: MachineCategory, technology?: Technology) {
  const key = `${title}/${machineCategory}/${technology}`;
  if (!models.has(key)) {
    const created = await run(
      executeCommand(
        createMachineModelCommand,
        { title, manufacturer: "Bally", machineCategory, technology },
        { actor: tom, db, newId: randomUUID },
      ),
    );
    models.set(key, created.machineModelId);
  }
  return models.get(key)!;
}

/** A machine with that museum number. */
async function aMachine(
  museumNumber: string,
  title: string,
  machineCategory: MachineCategory,
  technology?: Technology,
  machineStatus: MachineStatus = "playable",
) {
  const registered = await run(
    executeCommand(
      registerMachineCommand,
      {
        machineModelId: await modelOf(title, machineCategory, technology),
        museumNumber,
        serialNumber: undefined,
        location: "Hall 1",
        machineStatus,
      },
      { actor: tom, db, clock: fixedClock("2025-06-01T09:00:00Z"), newId: randomUUID },
    ),
  );
  return registered.machineId;
}

const numbered = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => `LG-${String(from + index).padStart(3, "0")}`);

/** The form page as the technician gets it: the markup, and the texts of the headers of its groups, in order. */
async function formPage() {
  const html = renderToStaticMarkup(createElement(AddMaintenanceTaskForm, await loadAddMaintenanceTask(db)));
  const headers = [...html.matchAll(/<summary[^>]*>(.*?)<\/summary>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));
  return { html, headers };
}

describe("the machines to choose for a new maintenance task", () => {
  it("ST-094: The choice is grouped, ordered and closed when the form opens", async () => {
    for (const museumNumber of numbered(5, 6)) await aMachine(museumNumber, "Fireball", "pinball", "em");
    for (const museumNumber of numbered(42, 10)) await aMachine(museumNumber, "Medieval Madness", "pinball", "dmd");
    for (const museumNumber of numbered(60, 4)) await aMachine(museumNumber, "Galaxian", "arcade", "crt");
    for (const museumNumber of numbered(70, 3)) await aMachine(museumNumber, "Jukebox", "other");

    const { html, headers } = await formPage();

    expect(headers).toEqual([
      "Flipper · EM – 0 von 6 ausgewählt",
      "Flipper · DMD – 0 von 10 ausgewählt",
      "Arcade · CRT – 0 von 4 ausgewählt",
      "Sonstiges – 0 von 3 ausgewählt",
    ]);
    // No group for a technology without a machine; every group is closed.
    expect(html).not.toContain("Solid-State");
    expect(html).not.toContain("LCD");
    expect(html).not.toMatch(/<details[^>]* open/);
    // Opening a group shows its machines by museum number.
    const eM = html.split("<details")[1];
    expect([...eM.matchAll(/LG-\d{3} · Fireball/g)].map((match) => match[0])).toEqual(
      numbered(5, 6).map((museumNumber) => `${museumNumber} · Fireball`),
    );
    // "Alle auswählen" needs JavaScript: the server renders no button.
    expect(html).not.toContain("Alle auswählen");
  });

  it("ST-094: Retired machines are not offered, machines not on display say so", async () => {
    await aMachine("LG-005", "Fireball", "pinball", "em");
    const retired = await aMachine("LG-013", "Fireball", "pinball", "em");
    await aMachine("LG-030", "Fireball", "pinball", "em", "not-on-display");
    await retireMachine(db, retired);

    const { html, headers } = await formPage();

    expect(headers).toEqual(["Flipper · EM – 0 von 2 ausgewählt"]);
    expect(html).not.toContain("LG-013");
    expect(html).toContain("LG-005 · Fireball<");
    expect(html).toContain("LG-030 · Fireball · Nicht ausgestellt<");
  });

  it("ST-094: No machine registered yet", async () => {
    const empty = await formPage();
    expect(empty.html).toContain(
      "Noch kein Gerät erfasst. Die Wartungsaufgabe lässt sich trotzdem hinzufügen und gilt dann für kein Gerät.",
    );
    expect(empty.headers).toEqual([]);

    // Every registered machine retired is the same case.
    await retireMachine(db, await aMachine("LG-013", "Fireball", "pinball", "em"));
    expect((await formPage()).html).toContain("Noch kein Gerät erfasst.");

    // The maintenance task can still be added, and applies to no machine.
    const { version } = await maintenancePlan(db);
    await run(
      executeCommand(
        changeMaintenancePlanCommand,
        {
          version,
          change: "add",
          task: { name: "Oil the gum machine", instruction: "Oil it.", intervalMonths: 12, suitableForHelpers: false, machineIds: [] },
        },
        { actor: tom, db, newId: randomUUID },
      ),
    );
    expect(renderToStaticMarkup(createElement(MaintenancePlanView, { plan: await maintenancePlan(db) }))).toContain(
      "Gilt für kein Gerät",
    );
  });

  it("names the machines retired meanwhile by their museum numbers, in the order ticked", async () => {
    const [lg005, lg044, lg045] = [
      await aMachine("LG-005", "Fireball", "pinball", "em"),
      await aMachine("LG-044", "Fireball", "pinball", "em"),
      await aMachine("LG-045", "Fireball", "pinball", "em"),
    ];
    await retireMachine(db, lg045);
    await retireMachine(db, lg044);

    expect(await retiredAmong(db, [lg005, lg045, lg044, lg045])).toEqual(["LG-045", "LG-044"]);
    expect(await retiredAmong(db, [lg005, randomUUID(), "not-an-id"])).toEqual([]);
  });
});

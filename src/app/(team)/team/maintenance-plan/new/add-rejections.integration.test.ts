import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { machineLabels } from "@/modules/collection";
import { changeMaintenancePlanCommand, maintenancePlan, maintenancePlanVersion } from "@/modules/maintenance";
import { GroupedChoice } from "@/components/ui/grouped-choice";
import { fixedClock } from "@/platform/clock";
import { teamMessages } from "@/platform/messages";
import { post } from "@/test-support/forms";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aRegisteredMachine, retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadAddMaintenanceTask } from "./add-maintenance-task-data";
import { addMaintenanceTaskFields, addMaintenanceTaskInput, MACHINE_FIELD } from "./add-maintenance-task-input";
import { machinesRejectionText } from "../machines-rejection-text";
import { retiredAmong } from "../retired-among";

/**
 * A rejected „Wartungsaufgabe hinzufügen“ from the form's side (ST-094): the runner keeps the ticked machines, the
 * rejection is in words – naming the machines retired meanwhile – and the choice is shown again with its groups open.
 */
const isolated = isolatedTestDatabase("add_rejections");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

// The maintenance plan is one aggregate: a database of its own, so no other test changes its version meanwhile.
beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});
afterAll(() => isolated.close());

/** The form as the technician sends it, with those machines ticked. */
async function send(machineIds: string[], fields: Record<string, string> = {}) {
  const form = post({
    version: String(await maintenancePlanVersion(db)),
    name: `Wax playfield ${randomUUID()}`,
    instruction: "Wax it.",
    intervalMonths: "12",
    ...fields,
  });
  for (const machineId of machineIds) form.append(MACHINE_FIELD, machineId);
  return formRunner({
    currentPerson: async () => tom,
    db,
    clock: fixedClock("2026-10-15T10:00:00Z"),
    newId: randomUUID,
  })(changeMaintenancePlanCommand, {
    fields: addMaintenanceTaskFields,
    many: { field: MACHINE_FIELD },
    input: addMaintenanceTaskInput,
    onSuccess: async () => {},
  })(null, form);
}

/** The choice as the form shows it again after the rejection: the machines in their groups, `chosen` ticked. */
async function choiceAfter(chosen: readonly string[]) {
  const { groups } = await loadAddMaintenanceTask(db);
  return renderToStaticMarkup(
    createElement(GroupedChoice, {
      name: MACHINE_FIELD,
      groups,
      chosen,
      header: teamMessages.maintenancePlan.machines.groupHeader,
      selectAll: teamMessages.maintenancePlan.machines.selectAll,
    }),
  );
}

/** The `<details>` of the group holding that machine, and whether its checkbox is ticked. */
async function groupOf(html: string, machineId: string) {
  const group = html.split("<details").find((part) => part.includes(`value="${machineId}"`))!;
  const box = group.match(new RegExp(`<input[^>]*value="${machineId}"[^>]*>`))![0];
  return { open: /^[^>]* open/.test(group), ticked: box.includes("checked") };
}

describe("a rejected „Wartungsaufgabe hinzufügen“", () => {
  it("ST-094: A rejected task keeps the chosen machines and opens their groups", async () => {
    const lg005 = await aRegisteredMachine(db);

    const state = await send([lg005], { instruction: "   " });

    expect(state).toMatchObject({
      error: "instruction-required",
      chosen: [lg005],
      values: { name: expect.any(String), intervalMonths: "12" },
    });
    expect(await groupOf(await choiceAfter(state!.chosen), lg005)).toEqual({ open: true, ticked: true });
    // Without a choice every group stays closed.
    expect((await groupOf(await choiceAfter([]), lg005)).open).toBe(false);
  });

  it("ST-094: The interval must be positive", async () => {
    const lg005 = await aRegisteredMachine(db);
    const { maintenanceTasks } = await maintenancePlan(db);

    const state = await send([lg005], { intervalMonths: "0" });

    expect(state).toMatchObject({ error: "interval-not-positive", chosen: [lg005] });
    expect(machinesRejectionText(state!)).toBe("Bitte ein Intervall von mindestens 1 Monat angeben.");
    expect((await groupOf(await choiceAfter(state!.chosen), lg005)).ticked).toBe(true);
    expect((await maintenancePlan(db)).maintenanceTasks).toHaveLength(maintenanceTasks.length);
  });

  it("ST-094: A machine retired meanwhile rejects the whole step", async () => {
    const [lg005, lg044] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    const museumNumber = (await machineLabels(db, [lg044])).get(lg044)!.museumNumber;
    const { maintenanceTasks } = await maintenancePlan(db);
    await retireMachine(db, lg044);

    const state = await send([lg005, lg044]);

    expect(state).toMatchObject({ error: "machine-retired", chosen: [lg005, lg044] });
    // What the Server Action adds: the machines retired meanwhile, as the page sees them now.
    const retired = await retiredAmong(db, state!.chosen);
    expect(retired).toEqual([museumNumber]);
    expect(machinesRejectionText({ error: state!.error, retired })).toBe(
      `${museumNumber} ist inzwischen ausgemustert. Es wurde nichts gespeichert.`,
    );
    // Nothing was stored, and the other machine stays ticked in its open group.
    expect((await maintenancePlan(db)).maintenanceTasks).toHaveLength(maintenanceTasks.length);
    expect(await groupOf(await choiceAfter([lg005]), lg005)).toEqual({ open: true, ticked: true });
  });

  it("ST-094: An unknown or doubled machine in a forged step rejects the whole step", async () => {
    const lg005 = await aRegisteredMachine(db);

    const unknown = await send([lg005, randomUUID()]);
    expect(unknown).toMatchObject({ error: "unknown-machine" });
    expect(machinesRejectionText(unknown!)).toBe("Dieses Gerät gibt es nicht. Es wurde nichts gespeichert.");

    const doubled = await send([lg005, lg005]);
    expect(doubled).toMatchObject({ error: "machine-chosen-twice" });
    expect(machinesRejectionText(doubled!)).toBe("Ein Gerät wurde mehrfach gewählt. Es wurde nichts gespeichert.");
  });
});

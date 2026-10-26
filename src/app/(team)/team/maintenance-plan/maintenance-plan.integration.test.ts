import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { changeMaintenancePlanCommand, maintenancePlan } from "@/modules/maintenance";
import { aRegisteredMachine } from "@/test-support/machines";
import { fixedClock } from "@/platform/clock";
import type { Actor } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { MaintenancePlanView } from "./maintenance-plan";
import { addMaintenanceTaskFields, addMaintenanceTaskInput, MACHINE_FIELD } from "./new/add-maintenance-task-input";
import {
  changeMaintenanceTaskFields,
  changeMaintenanceTaskInput,
  removeMaintenanceTaskFields,
  removeMaintenanceTaskInput,
} from "./[maintenanceTaskId]/change-maintenance-task-input";

/**
 * The maintenance plan's page and its form „Wartungsaufgabe hinzufügen“ (ST-040): the form's fields and input function
 * run through the Server Action runner as the signed-in team member; the page lists what was added. In a database of
 * its own: the maintenance plan is one aggregate, and the command's tests change it in the shared database at the same
 * time (ST-040 code review). Every test finds its own maintenance task by a name no other test uses.
 */
const isolated = isolatedTestDatabase("maintenance_plan_page");
let db: NodePgDatabase;
const clock = fixedClock("2026-10-15T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

function formOf(actor: Actor) {
  const added: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(
    changeMaintenancePlanCommand,
    {
      fields: addMaintenanceTaskFields,
      many: { field: MACHINE_FIELD },
      input: addMaintenanceTaskInput,
      onSuccess: async ({ maintenanceTaskId }) => void added.push(maintenanceTaskId),
    },
  );
  return { action, added };
}

/** The form as the technician fills it in – at the version of the plan the page shows now. */
async function filledIn(fields: Record<string, string | undefined>, machineIds: string[] = []) {
  const { version } = await maintenancePlan(db);
  const all: Record<string, string | undefined> = {
    version: String(version),
    name: `Clean glass (inside & out) ${randomUUID()}`,
    instruction: "Glass out, clean both sides.",
    intervalMonths: "1",
    suitableForHelpers: "on",
    ...fields,
  };
  // A checkbox that is not ticked is not sent at all.
  const form = post(
    Object.fromEntries(Object.entries(all).filter((entry): entry is [string, string] => entry[1] !== undefined)),
  );
  for (const machineId of machineIds) form.append(MACHINE_FIELD, machineId);
  return form;
}

/** The entry of the maintenance task of that name on the page – its name as the HTML writes it. */
const entryOf = (html: string, name: string) =>
  html.slice(html.indexOf(name.replaceAll("&", "&amp;"))).split("</article>")[0];

async function page() {
  return renderToStaticMarkup(createElement(MaintenancePlanView, { plan: await maintenancePlan(db) }));
}

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

afterAll(() => isolated.close());

describe("the form „Wartungsaufgabe hinzufügen“ and the maintenance plan", () => {
  it("adds the maintenance task, which the maintenance plan then lists with all it was given", async () => {
    const name = `Clean glass (inside & out) ${randomUUID()}`;
    const form = formOf(tom);
    const machines = [await aRegisteredMachine(db), await aRegisteredMachine(db)];

    expect(await form.action(null, await filledIn({ name }, machines))).toBeNull();

    expect(form.added).toHaveLength(1);
    const entry = entryOf(await page(), name);
    expect(entry).toContain("Glass out, clean both sides.");
    expect(entry).toContain("Jeden Monat");
    expect(entry).toContain("Für Helfer:innen geeignet");
    expect(entry).toContain("Gilt für 2 Geräte");
    // No restriction to a machine category or technology and no start date any more.
    expect(entry).not.toContain("Nur Flipper");
    expect(entry).not.toContain("Start ");
  });

  it("says how many machines each task applies to – none, one or several", async () => {
    const none = `Oil the gum machine ${randomUUID()}`;
    const one = `Check the power cord ${randomUUID()}`;
    const [first, second] = [await aRegisteredMachine(db), await aRegisteredMachine(db)];
    await formOf(tom).action(null, await filledIn({ name: none, suitableForHelpers: undefined }));
    await formOf(tom).action(null, await filledIn({ name: one, intervalMonths: "6" }, [first]));

    const html = await page();
    expect(entryOf(html, none)).toContain("Gilt für kein Gerät");
    expect(entryOf(html, none)).not.toContain("Für Helfer:innen geeignet");
    expect(entryOf(html, one)).toContain("Gilt für 1 Gerät");
    expect(entryOf(html, one)).toContain("Alle 6 Monate");
    expect(second).toBeDefined();
  });

  it("keeps what was typed when it is rejected, and never fills in a value", async () => {
    const zero = await formOf(tom).action(null, await filledIn({ name: "Wax", intervalMonths: "0" }));
    expect(zero).toMatchObject({ error: "interval-not-positive", values: { name: "Wax", intervalMonths: "0" } });
    expect(commandErrorText(teamMessages, zero!.error)).toBe("Bitte ein Intervall von mindestens 1 Monat angeben.");

    // No interval and a broken one are "nothing given", which the command rejects.
    expect((await formOf(tom).action(null, await filledIn({ intervalMonths: "" })))?.error).toBe(
      "interval-not-positive",
    );
    expect((await formOf(tom).action(null, await filledIn({ intervalMonths: "1.5" })))?.error).toBe(
      "interval-not-positive",
    );
    expect((await formOf(tom).action(null, await filledIn({ intervalMonths: "99999999999" })))?.error).toBe(
      "interval-too-long",
    );
  });

  it("is not for helpers – a forged role is not read", async () => {
    const name = `Wax the playfield ${randomUUID()}`;

    const byHelper = await formOf(anna).action(null, await filledIn({ name, role: "technician" }));

    expect(byHelper?.error).toBe("not-authorized");
    expect(await page()).not.toContain(name);
  });

  it("says what to do while the maintenance plan is empty (G7)", () => {
    const html = renderToStaticMarkup(createElement(MaintenancePlanView, { plan: { maintenanceTasks: [] } }));

    expect(html).toContain("Noch keine Wartungsaufgabe im Wartungsplan.");
    expect(html).toMatch(/<a [^>]*href="\/team\/maintenance-plan\/new"[^>]*>Wartungsaufgabe hinzufügen<\/a>/);
  });
});

describe("the change form of a maintenance task (ST-041)", () => {
  const run = (actor: Actor, remove = false) =>
    formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(
      changeMaintenancePlanCommand,
      remove
        ? { fields: removeMaintenanceTaskFields, input: removeMaintenanceTaskInput, onSuccess: async () => {} }
        : { fields: changeMaintenanceTaskFields, input: changeMaintenanceTaskInput, onSuccess: async () => {} },
    );

  /** A maintenance task added through the form – its ID. */
  async function added(name: string) {
    const form = formOf(tom);
    await form.action(null, await filledIn({ name }));
    return form.added[0];
  }

  /** The change form as the technician sends it – the task as added, with `fields` changed. */
  async function sent(maintenanceTaskId: string, fields: Record<string, string | undefined>) {
    const posted = await filledIn({ maintenanceTaskId, ...fields });
    posted.delete("name");
    return posted;
  }

  it("changes the maintenance task with what was sent – the name stays", async () => {
    const name = `Clean playfield ${randomUUID()}`;
    const id = await added(name);

    const outcome = await run(tom)(
      null,
      await sent(id, { intervalMonths: "2", suitableForHelpers: undefined, name: "Renamed" }),
    );

    expect(outcome).toBeNull();
    const entry = entryOf(await page(), name);
    expect(entry).toContain("Alle 2 Monate");
    expect(entry).not.toContain("Für Helfer:innen geeignet");
    expect(await page()).not.toContain("Renamed");
  });

  it("keeps what was typed when it is rejected – a forged role is not read", async () => {
    const name = `Wax playfield ${randomUUID()}`;
    const id = await added(name);

    const rejected = await run(tom)(null, await sent(id, { intervalMonths: "0", instruction: "Carnauba only." }));
    expect(rejected).toMatchObject({
      error: "interval-not-positive",
      values: { maintenanceTaskId: id, intervalMonths: "0", instruction: "Carnauba only." },
    });

    const byHelper = await run(anna)(null, await sent(id, { intervalMonths: "6", role: "technician" }));
    expect(byHelper?.error).toBe("not-authorized");
    const removedByHelper = await run(anna, true)(null, await sent(id, { role: "technician" }));
    expect(removedByHelper?.error).toBe("not-authorized");
    expect(entryOf(await page(), name)).toContain("Jeden Monat");
  });

  it("removes the maintenance task, and a second removal says it is gone", async () => {
    const name = `Wax playfield ${randomUUID()}`;
    const id = await added(name);

    expect(await run(tom, true)(null, await sent(id, {}))).toBeNull();
    expect(await page()).not.toContain(name);

    const again = await run(tom, true)(null, await sent(id, {}));
    expect(again?.error).toBe("maintenance-task-unknown");
    expect(commandErrorText(teamMessages, again!.error)).toBe("Diese Wartungsaufgabe gibt es nicht mehr.");
  });
});

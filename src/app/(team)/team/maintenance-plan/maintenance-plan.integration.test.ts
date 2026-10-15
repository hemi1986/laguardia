import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { changeMaintenancePlanCommand, maintenancePlan } from "@/modules/maintenance";
import { fixedClock } from "@/platform/clock";
import type { Actor } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { MaintenancePlanView } from "./maintenance-plan";
import { addMaintenanceTaskFields, addMaintenanceTaskInput } from "./new/add-maintenance-task-input";

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
      input: addMaintenanceTaskInput,
      onSuccess: async ({ maintenanceTaskId }) => void added.push(maintenanceTaskId),
    },
  );
  return { action, added };
}

/** The form as the technician fills it in – at the version of the plan the page shows now. */
async function filledIn(fields: Record<string, string | undefined>) {
  const { version } = await maintenancePlan(db);
  const all: Record<string, string | undefined> = {
    version: String(version),
    name: `Clean glass (inside & out) ${randomUUID()}`,
    instruction: "Glass out, clean both sides.",
    intervalMonths: "1",
    suitableForHelpers: "on",
    machineCategory: "pinball",
    technology: "",
    startDate: "2026-10-01",
    ...fields,
  };
  // A checkbox that is not ticked is not sent at all.
  return post(
    Object.fromEntries(Object.entries(all).filter((entry): entry is [string, string] => entry[1] !== undefined)),
  );
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

    expect(await form.action(null, await filledIn({ name }))).toBeNull();

    expect(form.added).toHaveLength(1);
    const entry = entryOf(await page(), name);
    expect(entry).toContain("Glass out, clean both sides.");
    expect(entry).toContain("Jeden Monat");
    expect(entry).toContain("Für Helfer:innen geeignet");
    expect(entry).toContain("Nur Flipper");
    expect(entry).toContain("Start 01.10.2026 · erstmals fällig 01.11.2026");
  });

  it("names the restriction in words – a machine category with its technology, or none", async () => {
    const reels = `Clean & adjust score reels ${randomUUID()}`;
    const everywhere = `Check the power cord ${randomUUID()}`;
    await formOf(tom).action(
      null,
      await filledIn({ name: reels, machineCategory: "pinball", technology: "em", intervalMonths: "6" }),
    );
    await formOf(tom).action(
      null,
      await filledIn({ name: everywhere, machineCategory: "", suitableForHelpers: undefined }),
    );

    const html = await page();
    expect(entryOf(html, reels)).toContain("Nur Flipper · EM");
    expect(entryOf(html, reels)).toContain("Alle 6 Monate");
    expect(entryOf(html, everywhere)).toContain("Alle Geräte");
    expect(entryOf(html, everywhere)).not.toContain("Für Helfer:innen geeignet");
  });

  it("keeps what was typed when it is rejected, and never fills in a value", async () => {
    const zero = await formOf(tom).action(null, await filledIn({ name: "Wax", intervalMonths: "0" }));
    expect(zero).toMatchObject({ error: "interval-not-positive", values: { name: "Wax", intervalMonths: "0" } });
    expect(commandErrorText(teamMessages, zero!.error)).toBe("Bitte ein Intervall von mindestens 1 Monat angeben.");

    // No interval, a broken one, no start date – each is "nothing given", which the command rejects.
    expect((await formOf(tom).action(null, await filledIn({ intervalMonths: "" })))?.error).toBe(
      "interval-not-positive",
    );
    expect((await formOf(tom).action(null, await filledIn({ intervalMonths: "1.5" })))?.error).toBe(
      "interval-not-positive",
    );
    expect((await formOf(tom).action(null, await filledIn({ startDate: "" })))?.error).toBe("start-date-required");
    expect((await formOf(tom).action(null, await filledIn({ startDate: "31.01.2026" })))?.error).toBe(
      "start-date-required",
    );
    // Not a real calendar date: rejected at the form, never a failing insert.
    expect((await formOf(tom).action(null, await filledIn({ startDate: "2026-02-31" })))?.error).toBe(
      "start-date-required",
    );
    expect((await formOf(tom).action(null, await filledIn({ intervalMonths: "99999999999" })))?.error).toBe(
      "interval-too-long",
    );
    expect((await formOf(tom).action(null, await filledIn({ machineCategory: "", technology: "lcd" })))?.error).toBe(
      "technology-without-machine-category",
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

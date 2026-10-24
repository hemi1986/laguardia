import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { withoutMaintenanceTasks } from "@/modules/maintenance/maintenance.test-support";
import {
  changeDefectDetailsCommand,
  claimDefectCommand,
  logWorkCommand,
  prioritizeDefectCommand,
  putDefectOnHoldCommand,
  releaseClaimCommand,
  reportProblemAndTriageCommand,
  resolveDefectCommand,
  resumeDefectCommand,
} from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Command } from "@/platform/command";
import { hoursBefore } from "@/platform/time";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { HelperDashboard } from "./helper-dashboard";
import { loadHelperDashboard } from "./helper-dashboard-data";

/**
 * What changed on the defects a helper claimed (RM-HelperDashboard, ST-086), in section 1 of the helper dashboard
 * (ST-049) – read from the event journal. In a database of its own, so "nothing is open" can be arranged.
 */
const isolated = isolatedTestDatabase("helper_dashboard_changes");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
type Person = typeof tom | typeof anna | typeof ben;
let machineModelId: string;
const NOW = new Date("2026-06-10T10:00:00Z");

/** That many hours before NOW. */
const hoursAgo = (hours: number) => hoursBefore(NOW, hours);
const daysAgo = (days: number) => hoursAgo(days * 24);

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, ben, "Ben");
  const model = await run(
    executeCommand(
      createMachineModelCommand,
      { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
      { actor: tom, db, newId: randomUUID },
    ),
  );
  machineModelId = model.machineModelId;
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

/**
 * An open defect suitable for helpers, recorded by Tom 30 days ago on a machine of its own – and what people do on it,
 * each step at the defect's current version.
 */
async function aDefect(title: string) {
  const at = { actor: tom, db, clock: fixedClock(daysAgo(30)), newId: randomUUID };
  const { machineId } = await run(
    executeCommand(
      registerMachineCommand,
      {
        machineModelId,
        museumNumber: undefined,
        serialNumber: undefined,
        location: "Hall 1",
        machineStatus: "playable",
      },
      at,
    ),
  );
  const { defectId } = await run(
    executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId,
        description: `${title} – first seen`,
        triage: {
          outcome: "defect-recorded",
          title,
          priority: undefined,
          suitableForHelpers: true,
          machineStatus: undefined,
          machineVersion: undefined,
        },
      },
      at,
    ),
  );
  let version = 0;
  const step = async <Input>(
    command: Command<Input & { defectId: string; version: number }, unknown, string>,
    input: Input,
    by: Person,
    when: Date,
  ) => {
    await run(
      executeCommand(
        command,
        { ...input, defectId: defectId!, version } as Input & { defectId: string; version: number },
        {
          actor: by,
          db,
          clock: fixedClock(when),
          newId: randomUUID,
        },
      ),
    );
    version += 1;
  };
  return {
    claim: (by: Person, when: Date) => step(claimDefectCommand, {}, by, when),
    assign: (to: Person, when: Date) => step(claimDefectCommand, { assignTo: to.teamMemberId }, tom, when),
    release: (by: Person, when: Date) => step(releaseClaimCommand, {}, by, when),
    resolve: (by: Person, when: Date) =>
      step(resolveDefectCommand, { closingNote: `${title} – fixed` }, by, when),
    logWork: (by: Person, when: Date) =>
      step(logWorkCommand, { whatWasDone: `Worked on ${title}`, partsUsed: "" }, by, when),
    prioritize: (when: Date) => step(prioritizeDefectCommand, { priority: "high" as const }, tom, when),
    putOnHold: (by: Person, when: Date) =>
      step(putDefectOnHoldCommand, { reason: "waiting-for-part" as const }, by, when),
    resume: (by: Person, when: Date) => step(resumeDefectCommand, {}, by, when),
    changeDetails: (details: { title?: string; suitableForHelpers?: boolean }, when: Date) =>
      step(changeDefectDetailsCommand, { title, suitableForHelpers: true, ...details }, tom, when),
  };
}

async function dashboard() {
  const data = await loadHelperDashboard(db, fixedClock(NOW), { id: anna.teamMemberId, role: "helper" });
  return { data, html: renderToStaticMarkup(createElement(HelperDashboard, { data })) };
}

/** The text of section 1 – „Von dir übernommen“ up to the next section. */
function sectionOne(html: string) {
  return html.slice(html.indexOf("Von dir übernommen"), html.indexOf("Für Helfer:innen geeignet"));
}

describe("what changed on the helper's claimed defects", () => {
  it("ST-086: Helper sees that a claimed defect was taken over", async () => {
    const rubber = await aDefect("Rubber cracked");
    await rubber.claim(anna, daysAgo(5));
    await rubber.claim(ben, daysAgo(2));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Rubber cracked");
    expect(section).toContain("Ben hat übernommen · vor 2 Tagen");
  });

  it("ST-086: A taken-over defect keeps section 1 and the dashboard from saying empty", async () => {
    const rubber = await aDefect("Rubber cracked");
    await rubber.claim(anna, daysAgo(5));
    await rubber.claim(ben, daysAgo(1));
    // No longer suitable for helpers since – so it is not open among the defects suitable for helpers either.
    await rubber.changeDetails({ suitableForHelpers: false }, hoursAgo(1));

    const { html } = await dashboard();

    expect(sectionOne(html)).toContain("Rubber cracked");
    expect(sectionOne(html)).toContain("Ben hat übernommen");
    expect(html).not.toContain("Du hast keinen Defekt übernommen.");
    expect(html).not.toContain("Gerade ist nichts für dich offen.");
  });

  it("ST-086: Helper sees that her claimed defect was assigned to someone else", async () => {
    const rubber = await aDefect("Rubber cracked");
    await rubber.claim(anna, daysAgo(5));
    await rubber.assign(ben, daysAgo(1));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Rubber cracked");
    expect(section).toContain("Tom hat Ben zugewiesen · vor 1 Tag");
  });

  it("ST-086: Helper sees that a technician released her claim", async () => {
    const rubber = await aDefect("Rubber cracked");
    await rubber.claim(anna, daysAgo(5));
    await rubber.release(tom, hoursAgo(5));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Rubber cracked");
    expect(section).toContain("Tom hat die Übernahme aufgehoben · vor 5 Stunden");
  });

  it("ST-086: Removing the mark says why her claim was released", async () => {
    const rubber = await aDefect("Rubber cracked");
    await rubber.claim(anna, daysAgo(5));
    await rubber.changeDetails({ suitableForHelpers: false }, daysAgo(3));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Rubber cracked");
    expect(section).toContain(
      "<li>Tom hat die Übernahme aufgehoben – nicht mehr für Helfer:innen geeignet · vor 3 Tagen</li></ul>",
    );
  });

  it("ST-086: Helper sees that someone else resolved her claimed defect", async () => {
    const rubber = await aDefect("Rubber cracked");
    await rubber.claim(anna, daysAgo(5));
    await rubber.resolve(tom, daysAgo(1));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Rubber cracked");
    expect(section).toContain("Behoben von Tom · vor 1 Tag");
  });

  it("ST-086: A defect that left her stays listed for 7 days", async () => {
    const rubber = await aDefect("Rubber cracked");
    await rubber.claim(anna, daysAgo(10));
    await rubber.claim(ben, hoursAgo(7 * 24 - 1));
    const display = await aDefect("Display flickers");
    await display.claim(anna, daysAgo(10));
    await display.resolve(tom, hoursAgo(7 * 24 + 1));

    const { html } = await dashboard();

    expect(sectionOne(html)).toContain("Rubber cracked");
    expect(sectionOne(html)).toContain("Ben hat übernommen");
    expect(html).not.toContain("Display flickers");
  });

  it("ST-086: Helper sees what changed on her claimed defects", async () => {
    const slingshot = await aDefect("Slingshot switch loose");
    await slingshot.claim(anna, daysAgo(5));
    await slingshot.logWork(tom, daysAgo(4));
    await slingshot.changeDetails({ title: "Slingshot switch loose (left)" }, daysAgo(2));

    const section = sectionOne((await dashboard()).html);

    // The title as it is now – the line only says it changed.
    expect(section).toContain("Slingshot switch loose (left)");
    expect(section).toContain("<li>Neuer Arbeitsschritt von Tom · vor 4 Tagen</li>");
    expect(section).toContain("<li>Titel geändert · vor 2 Tagen</li>");
  });

  it("ST-086: Priority changes and resuming are listed", async () => {
    const display = await aDefect("Display flickers");
    await display.claim(anna, daysAgo(5));
    await display.prioritize(daysAgo(3));
    await display.putOnHold(tom, daysAgo(2));
    await display.resume(tom, hoursAgo(3));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Display flickers");
    expect(section).toContain(
      "<li>Fortgesetzt · vor 3 Stunden</li><li>Pausiert – Wartet auf Ersatzteil · vor 2 Tagen</li><li>Priorität: hoch · vor 3 Tagen</li>",
    );
  });

  it("ST-086: A hold on her claimed defect is shown with its reason", async () => {
    const display = await aDefect("Display flickers");
    await display.claim(anna, daysAgo(5));
    await display.putOnHold(tom, daysAgo(1));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Display flickers");
    expect(section).toContain("<li>Pausiert – Wartet auf Ersatzteil · vor 1 Tag</li>");
  });

  it("ST-086: Change lines are listed newest first, each with when it happened", async () => {
    const slingshot = await aDefect("Slingshot switch loose");
    await slingshot.claim(anna, daysAgo(5));
    await slingshot.logWork(tom, daysAgo(4));
    await slingshot.changeDetails({ title: "Slingshot switch loose (left)" }, daysAgo(2));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("<li>Titel geändert · vor 2 Tagen</li><li>Neuer Arbeitsschritt von Tom · vor 4 Tagen</li>");
  });

  it("ST-086: Changes before her claim are not listed", async () => {
    const slingshot = await aDefect("Slingshot switch loose");
    await slingshot.changeDetails({ title: "Slingshot switch loose (left)" }, daysAgo(3));
    await slingshot.claim(anna, daysAgo(2));

    const section = sectionOne((await dashboard()).html);

    expect(section).toContain("Slingshot switch loose (left)");
    expect(section).not.toContain("Titel geändert");
  });
});

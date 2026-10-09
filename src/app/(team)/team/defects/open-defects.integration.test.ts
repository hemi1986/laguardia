import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import {
  linkProblemReportToDefectCommand,
  recordDefectCommand,
  reportProblemCommand,
  type Priority,
} from "@/modules/repair";
import { resolveDefectForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadOpenDefects, type OpenDefectsFilter } from "./open-defects-data";
import { OpenDefectsView } from "./open-defects";

/**
 * The open defects list (RM-OpenDefects, ST-021): the page's data – Repair's open defects with Collection's museum
 * numbers and titles (the page composes, ST-009) – rendered by its view. In a database of its own, so "LG-042" and
 * "7 defects are open" can be arranged.
 */
const isolated = isolatedTestDatabase("open_defects");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = "2026-10-04T10:00:00Z";
let medievalMadness: string;
let attackFromMars: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  medievalMadness = await machineModel("Medieval Madness");
  attackFromMars = await machineModel("Attack from Mars");
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function machineModel(title: string) {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function registered(museumNumber: string, machineModelId = medievalMadness) {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

const daysBefore = (days: number) => new Date(new Date(NOW).getTime() - days * 86_400_000).toISOString();

/** A defect recorded through triage (CMD-RecordDefect) at the given time – the only way a defect comes to be. */
async function anOpenDefect(
  machineId: string,
  title: string,
  {
    priority = "normal",
    suitableForHelpers = false,
    at = daysBefore(1),
  }: Partial<{
    priority: Priority;
    suitableForHelpers: boolean;
    at: string;
  }> = {},
) {
  const clock = fixedClock(at);
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description: `${title} – reported` },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  const recorded = await executeCommand(
    recordDefectCommand,
    {
      problemReportId: reported.result.problemReportId,
      version: 0,
      title,
      priority,
      suitableForHelpers,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!recorded.ok) throw new Error(recorded.error);
  return recorded.result.defectId;
}

async function page(filter: OpenDefectsFilter = {}): Promise<string> {
  return renderToStaticMarkup(
    createElement(OpenDefectsView, { data: await loadOpenDefects(db, fixedClock(NOW), filter) }),
  );
}

describe("the open defects list", () => {
  it("ST-021: Team member sees all open defects", async () => {
    const lg042 = await registered("LG-042");
    const lg007 = await registered("LG-007", attackFromMars);
    await anOpenDefect(lg007, "Display flickers", { at: daysBefore(8) });
    await anOpenDefect(lg042, "Left flipper weak", { priority: "high", suitableForHelpers: true, at: daysBefore(5) });

    const { entries } = await loadOpenDefects(db, fixedClock(NOW), {});

    expect(
      entries.map(({ museumNumber, machineModelTitle, title, priority, suitableForHelpers, openSince }) => ({
        museumNumber,
        machineModelTitle,
        title,
        priority,
        suitableForHelpers,
        openSince,
      })),
    ).toEqual([
      {
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness",
        title: "Left flipper weak",
        priority: "high",
        suitableForHelpers: true,
        openSince: new Date(daysBefore(5)),
      },
      {
        museumNumber: "LG-007",
        machineModelTitle: "Attack from Mars",
        title: "Display flickers",
        priority: "normal",
        suitableForHelpers: false,
        openSince: new Date(daysBefore(8)),
      },
    ]);
    const html = await page();
    expect(html).toContain("LG-042 · Medieval Madness");
    expect(html).toContain("Left flipper weak");
    expect(html).toContain("Priorität: hoch");
    expect(html).toContain("Für Helfer:innen geeignet");
    expect(html).toContain("29.09.2026, 12:00 · offen seit 5 Tagen");
    expect(html).toContain("LG-007 · Attack from Mars");
    expect(html).toContain("Priorität: normal");
    expect(html.indexOf("Left flipper weak")).toBeLessThan(html.indexOf("Display flickers"));
  });

  it("ST-021: Oldest first within a priority", async () => {
    const lg042 = await registered("LG-042");
    await anOpenDefect(lg042, "Display flickers", { at: daysBefore(2) });
    await anOpenDefect(lg042, "Rubber cracked", { at: daysBefore(10) });

    const { entries } = await loadOpenDefects(db, fixedClock(NOW), {});

    expect(entries.map((entry) => entry.title)).toEqual(["Rubber cracked", "Display flickers"]);
  });

  it("ST-021: Filter by suitable for helpers", async () => {
    const lg042 = await registered("LG-042");
    await anOpenDefect(lg042, "Rubber cracked", { suitableForHelpers: true });
    await anOpenDefect(lg042, "Display flickers");

    const { entries } = await loadOpenDefects(db, fixedClock(NOW), { suitableForHelpers: true });

    expect(entries.map((entry) => entry.title)).toEqual(["Rubber cracked"]);
    const html = await page({ suitableForHelpers: true });
    expect(html).toContain("Rubber cracked");
    expect(html).not.toContain("Display flickers");
  });

  it("ST-021: Filter by machine", async () => {
    const lg042 = await registered("LG-042");
    const lg007 = await registered("LG-007", attackFromMars);
    await anOpenDefect(lg042, "Left flipper weak", { at: daysBefore(3) });
    await anOpenDefect(lg042, "Rubber cracked", { at: daysBefore(2) });
    await anOpenDefect(lg007, "Display flickers");

    const { entries } = await loadOpenDefects(db, fixedClock(NOW), { museumNumber: "LG-042" });

    expect(entries.map((entry) => [entry.museumNumber, entry.title])).toEqual([
      ["LG-042", "Left flipper weak"],
      ["LG-042", "Rubber cracked"],
    ]);
    expect(await page({ museumNumber: "LG-042" })).not.toContain("Display flickers");
  });

  it("ST-021: No defect is open", async () => {
    await registered("LG-042");

    const data = await loadOpenDefects(db, fixedClock(NOW), {});

    expect(data).toMatchObject({ entries: [], total: 0 });
    const html = await page();
    expect(html).toContain("Kein Defekt ist offen.");
    expect(html).toMatch(/<a [^>]*href="\/team\/triage"[^>]*>Zur Sichtung<\/a>/);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<li");
  });

  it("ST-021: How many defects are open", async () => {
    const lg042 = await registered("LG-042");
    for (const title of ["A", "B", "C", "D", "E", "F", "G"]) await anOpenDefect(lg042, `Defect ${title}`);

    const html = await page({ suitableForHelpers: true });

    expect(html).toContain("7 Defekte sind offen.");
  });

  it("ST-021: A filter that matches nothing", async () => {
    await anOpenDefect(await registered("LG-042"), "Display flickers");

    const html = await page({ suitableForHelpers: true });

    expect(html).not.toContain("Display flickers");
    expect(html).toContain("Kein offener Defekt ist für Helfer:innen geeignet.");
    expect(html).toMatch(/<a [^>]*href="\/team\/defects"[^>]*>Alle offenen Defekte anzeigen<\/a>/);
  });

  it("ST-021: Resolved defects are not listed", async () => {
    const lg042 = await registered("LG-042");
    await anOpenDefect(lg042, "Left flipper weak");
    const coinDoor = await anOpenDefect(lg042, "Coin door jammed");
    const resolved = await executeCommand(
      resolveDefectForTest,
      { defectId: coinDoor, version: 0 },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);

    const data = await loadOpenDefects(db, fixedClock(NOW), {});

    expect(data.entries.map((entry) => entry.title)).toEqual(["Left flipper weak"]);
    expect(data.total).toBe(1);
    expect(await page()).not.toContain("Coin door jammed");
  });

  it("counts how long a defect is open in Berlin calendar days, not in periods of 24 hours", async () => {
    const lg042 = await registered("LG-042");
    await anOpenDefect(lg042, "Left flipper weak", { at: "2026-10-03T21:00:00Z" }); // 23:00 in Berlin
    await anOpenDefect(lg042, "Display flickers", { at: "2026-10-04T05:30:00Z" }); // 07:30 in Berlin

    const html = renderToStaticMarkup(
      createElement(OpenDefectsView, {
        data: await loadOpenDefects(db, fixedClock("2026-10-04T06:00:00Z"), {}), // 08:00 in Berlin
      }),
    );

    expect(html).toContain("03.10.2026, 23:00 · offen seit 1 Tag");
    expect(html).toContain("04.10.2026, 07:30 · offen seit heute");
  });

  it("filters by priority, and combines the filters", async () => {
    const lg042 = await registered("LG-042");
    const lg007 = await registered("LG-007", attackFromMars);
    await anOpenDefect(lg042, "Left flipper weak", { priority: "high" });
    await anOpenDefect(lg042, "Rubber cracked", { priority: "high", suitableForHelpers: true });
    await anOpenDefect(lg007, "Coil burnt", { priority: "high", suitableForHelpers: true });
    await anOpenDefect(lg042, "Display flickers", { suitableForHelpers: true });

    const titles = async (filter: OpenDefectsFilter) =>
      (await loadOpenDefects(db, fixedClock(NOW), filter)).entries.map((entry) => entry.title).sort();

    expect(await titles({ priority: "high" })).toEqual(["Coil burnt", "Left flipper weak", "Rubber cracked"]);
    expect(await titles({ priority: "high", suitableForHelpers: true, museumNumber: "LG-042" })).toEqual([
      "Rubber cracked",
    ]);
  });

  it("offers the machines with open defects to filter by, and lists nothing for an unknown museum number", async () => {
    const lg042 = await registered("LG-042");
    const lg007 = await registered("LG-007", attackFromMars);
    await registered("LG-100");
    await anOpenDefect(lg042, "Left flipper weak");
    await anOpenDefect(lg007, "Display flickers");

    const data = await loadOpenDefects(db, fixedClock(NOW), { museumNumber: "LG-999" });

    expect(data.machines).toEqual([
      { museumNumber: "LG-007", machineModelTitle: "Attack from Mars" },
      { museumNumber: "LG-042", machineModelTitle: "Medieval Madness" },
    ]);
    expect(data.entries).toEqual([]);
  });

  it("shows how many problem reports are linked to a defect (ST-022)", async () => {
    const lg042 = await registered("LG-042");
    const leftFlipper = await anOpenDefect(lg042, "Left flipper weak");
    await anOpenDefect(lg042, "Display flickers");
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId: lg042, description: "Flipper on the left does nothing" },
      { actor: { kind: "visitor" }, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);
    const linked = await executeCommand(
      linkProblemReportToDefectCommand,
      { problemReportId: reported.result.problemReportId, version: 0, defectId: leftFlipper },
      { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    if (!linked.ok) throw new Error(linked.error);

    const html = await page();

    const entryOf = (title: string) => html.slice(html.indexOf(title)).split("</article>")[0];
    expect(entryOf("Left flipper weak")).toContain("1 verknüpfte Meldung");
    expect(entryOf("Display flickers")).not.toContain("verknüpfte");
  });
});

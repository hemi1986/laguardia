import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { reportProblemCommand } from "@/modules/repair";
import { triageForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadTriageList } from "./triage-list-data";
import { TriageListView } from "./triage-list";

/**
 * The triage list (RM-TriageList, ST-017): the page's data – Repair's untriaged problem reports with Collection's
 * museum numbers and titles and Team's names (the page composes, ST-009) – rendered by its view. In a database of its
 * own, so "LG-042" and "12 problem reports wait" can be arranged.
 */
const isolated = isolatedTestDatabase("triage_list");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const visitor: Actor = { kind: "visitor" };
const NOW = "2026-10-03T16:00:00Z";
let medievalMadness: string;
let attackFromMars: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
  medievalMadness = await machineModel("Medieval Madness");
  attackFromMars = await machineModel("Attack from Mars");
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function machineModel(title: string) {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function registered(museumNumber: string, machineModelId = medievalMadness) {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function reported(machineId: string, description: string, at: string, actor: Actor = visitor, photo?: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description, photo },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

const hoursBefore = (hours: number) => new Date(new Date(NOW).getTime() - hours * 3_600_000).toISOString();

async function page(): Promise<string> {
  return renderToStaticMarkup(createElement(TriageListView, { data: await loadTriageList(db, fixedClock(NOW)) }));
}

describe("the triage list", () => {
  it("ST-017: Technician sees untriaged problem reports", async () => {
    const lg042 = await registered("LG-042");
    const lg007 = await registered("LG-007", attackFromMars);
    await reported(lg007, "Rubber cracked", "2026-10-03T13:10:00Z", anna);
    await reported(lg042, "Ball stuck behind the left ramp", "2026-10-03T12:05:00Z");

    const data = await loadTriageList(db, fixedClock(NOW));

    expect(
      data.entries.map(({ museumNumber, machineModelTitle, description, reporter, reportedAt }) => ({
        museumNumber,
        machineModelTitle,
        description,
        reporter,
        reportedAt,
      })),
    ).toEqual([
      {
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness",
        description: "Ball stuck behind the left ramp",
        reporter: { kind: "visitor" },
        reportedAt: new Date("2026-10-03T12:05:00Z"),
      },
      {
        museumNumber: "LG-007",
        machineModelTitle: "Attack from Mars",
        description: "Rubber cracked",
        reporter: { kind: "team-member", name: "Anna" },
        reportedAt: new Date("2026-10-03T13:10:00Z"),
      },
    ]);
    const html = await page();
    expect(html).toContain("LG-042 · Medieval Madness");
    expect(html).toContain("Besucher:in · 03.10.2026, 14:05");
    expect(html).toContain("Anna · 03.10.2026, 15:10");
    expect(html.indexOf("LG-042")).toBeLessThan(html.indexOf("LG-007"));
  });

  it("ST-017: Problem reports waiting longer than 72 hours are highlighted", async () => {
    await reported(await registered("LG-042"), "Ball stuck", hoursBefore(73));
    await reported(await registered("LG-007"), "Rubber cracked", hoursBefore(71));

    const { entries } = await loadTriageList(db, fixedClock(NOW));

    expect(entries.map((entry) => [entry.museumNumber, entry.waitingLong])).toEqual([
      ["LG-042", true],
      ["LG-007", false],
    ]);
    const html = await page();
    const lg007 = html.indexOf("LG-007");
    expect(html.indexOf("Wartet länger als 3 Tage")).toBeGreaterThan(-1);
    expect(html.indexOf("Wartet länger als 3 Tage")).toBeLessThan(lg007);
    expect(html.slice(lg007)).not.toContain("Wartet länger als 3 Tage");
  });

  it("ST-017: The long wait is said in words", async () => {
    await reported(await registered("LG-042"), "Ball stuck", hoursBefore(73));

    expect(await page()).toContain("wartet seit 3 Tagen");
  });

  it("ST-017: How many problem reports wait", async () => {
    const machineId = await registered("LG-042");
    for (let n = 0; n < 12; n++) await reported(machineId, `Problem ${n}`, hoursBefore(12 - n));

    expect(await page()).toContain("12 Meldungen warten auf die Sichtung.");
  });

  it("ST-017: Triaged problem reports leave the list", async () => {
    const machineId = await registered("LG-042");
    const triaged = await reported(machineId, "Ball stuck", hoursBefore(5));
    await reported(machineId, "Rubber cracked", hoursBefore(4));
    const outcome = await executeCommand(
      triageForTest,
      { problemReportId: triaged, version: 0 },
      { actor: eva, db, clock: fixedClock(NOW), newId: randomUUID },
    );
    if (!outcome.ok) throw new Error("not triaged");

    const { entries } = await loadTriageList(db, fixedClock(NOW));

    expect(entries.map((entry) => entry.description)).toEqual(["Rubber cracked"]);
    expect(await page()).not.toContain("Ball stuck");
  });

  it("ST-017: Report text is never interpreted", async () => {
    await reported(await registered("LG-042"), "<script>alert(1)</script>", hoursBefore(1));

    const html = await page();

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("ST-016: Technician sees the photo in the triage list", async () => {
    const photo = `problem-reports/${randomUUID()}.jpg`;
    await reported(await registered("LG-042"), "Right flipper dead", hoursBefore(2), visitor, photo);
    await reported(await registered("LG-007"), "Rubber cracked", hoursBefore(1));

    const data = await loadTriageList(db, fixedClock(NOW), { storage: memoryStorage() });
    const html = renderToStaticMarkup(createElement(TriageListView, { data }));

    const address = `memory://${photo}?valid-until=2026-10-03T16:05:00.000Z`;
    expect(data.entries.map((entry) => [entry.museumNumber, entry.photo?.address])).toEqual([
      ["LG-042", address],
      ["LG-007", undefined],
    ]);
    expect(html).toContain(`<img src="${address}" alt="Foto zur Meldung"`);
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html.indexOf("<img ")).toBeLessThan(html.indexOf("LG-007"));
  });
});

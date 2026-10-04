import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { recordDefectCommand, reportProblemCommand } from "@/modules/repair";
import { linkToDefectForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadDefectDetails } from "./defect-details-data";
import { DefectDetailsView } from "./defect-details";

/**
 * A defect's own page (ST-021): Repair's defect and its problem reports with Collection's museum number and title and
 * Team's names – the page composes (ST-009). In a database of its own, so the machine can be "LG-042".
 */
const isolated = isolatedTestDatabase("defect_details");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const visitor: Actor = { kind: "visitor" };
const NOW = "2026-10-04T10:00:00Z";
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(museumNumber: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    { actor: tom, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

async function reported(machineId: string, description: string, at: string, actor: Actor = visitor) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

async function recorded(problemReportId: string, at: string) {
  const outcome = await executeCommand(
    recordDefectCommand,
    {
      problemReportId,
      version: 0,
      title: "Left flipper weak",
      priority: "high",
      suitableForHelpers: true,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: tom, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.defectId;
}

async function page(defectId: string): Promise<string> {
  return renderToStaticMarkup(
    createElement(DefectDetailsView, { details: await loadDefectDetails(db, fixedClock(NOW), defectId) }),
  );
}

describe("a defect's own page", () => {
  it("ST-021: Team member opens a defect", async () => {
    const lg042 = await registered("LG-042");
    const report = await reported(lg042, "Left flipper barely moves", "2026-09-29T09:30:00Z");
    const defectId = await recorded(report, "2026-09-29T10:00:00Z");

    const details = await loadDefectDetails(db, fixedClock(NOW), defectId);

    expect(details).toMatchObject({
      museumNumber: "LG-042",
      machineModelTitle: "Medieval Madness",
      title: "Left flipper weak",
      priority: "high",
      suitableForHelpers: true,
      openSince: new Date("2026-09-29T10:00:00Z"),
      problemReports: [
        {
          originating: true,
          description: "Left flipper barely moves",
          reporter: { kind: "visitor" },
          reportedAt: new Date("2026-09-29T09:30:00Z"),
        },
      ],
    });
    const html = await page(defectId);
    expect(html).toContain("Left flipper weak");
    expect(html).toMatch(/<a [^>]*href="\/team\/machines\/LG-042"[^>]*>LG-042 · Medieval Madness<\/a>/);
    expect(html).toContain("Priorität: hoch");
    expect(html).toContain("Für Helfer:innen geeignet");
    expect(html).toContain("Erfasst am 29.09.2026, 12:00 · offen seit 5 Tagen");
    expect(html).toContain("Ursprüngliche Meldung");
    expect(html).toContain("Left flipper barely moves");
    expect(html).toContain("Besucher:in · 29.09.2026, 11:30");
  });

  it("ST-021: Defect details show all linked problem reports", async () => {
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, anna, "Anna");
    const lg042 = await registered("LG-042");
    const defectId = await recorded(
      await reported(lg042, "Left flipper barely moves", "2026-09-29T09:30:00Z"),
      "2026-09-29T10:00:00Z",
    );
    for (const [description, at, actor] of [
      ["Flipper does not hold the ball", "2026-10-02T14:00:00Z", visitor],
      ["Left flipper sticks", "2026-10-01T08:15:00Z", anna],
    ] as const) {
      const linked = await executeCommand(
        linkToDefectForTest,
        { problemReportId: await reported(lg042, description, at, actor), version: 0, defectId },
        { actor: tom, db, clock: fixedClock(NOW), newId: randomUUID },
      );
      if (!linked.ok) throw new Error(linked.error);
    }
    await reported(lg042, "Coin door jammed", "2026-10-03T08:00:00Z");

    const details = await loadDefectDetails(db, fixedClock(NOW), defectId);

    expect(
      details?.problemReports.map(({ originating, description, reporter, reportedAt }) => ({
        originating,
        description,
        reporter,
        reportedAt,
      })),
    ).toEqual([
      {
        originating: true,
        description: "Left flipper barely moves",
        reporter: { kind: "visitor" },
        reportedAt: new Date("2026-09-29T09:30:00Z"),
      },
      {
        originating: false,
        description: "Left flipper sticks",
        reporter: { kind: "team-member", name: "Anna" },
        reportedAt: new Date("2026-10-01T08:15:00Z"),
      },
      {
        originating: false,
        description: "Flipper does not hold the ball",
        reporter: { kind: "visitor" },
        reportedAt: new Date("2026-10-02T14:00:00Z"),
      },
    ]);
    const html = await page(defectId);
    expect(html).toContain("Anna · 01.10.2026, 10:15");
    expect(html).toContain("Besucher:in · 02.10.2026, 16:00");
    expect(html.match(/Verknüpfte Meldung/g)).toHaveLength(2);
    expect(html).not.toContain("Coin door jammed");
  });

  it("says that a defect does not exist, for an unknown ID or an address that is no ID", async () => {
    expect(await loadDefectDetails(db, fixedClock(NOW), randomUUID())).toBeUndefined();
    expect(await loadDefectDetails(db, fixedClock(NOW), "not-an-id")).toBeUndefined();
    expect(await page("not-an-id")).toContain("Diesen Defekt gibt es nicht.");
  });
});

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { anOpenDefectIn } from "@/test-support/defects";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { defectDetails, openDefects, prioritizeDefectCommand, type Priority } from ".";

/** CMD-PrioritizeDefect (ST-027) through the command layer: a technician changes the priority of an open defect. */
const db = testDatabase();
const recorded = fixedClock("2026-10-14T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect on a machine of its own, recorded with the default priority normal – at version 0. */
const anOpenDefect = (title: string) =>
  anOpenDefectIn(db, { title, suitableForHelpers: true, recordedBy: tom, at: recorded });

function prioritize(defectId: string, version: number, priority: Priority | undefined, actor: Actor) {
  return executeCommand(
    prioritizeDefectCommand,
    { defectId, version, priority },
    { actor, db, clock: fixedClock("2026-10-14T10:00:00Z"), newId: randomUUID },
  );
}

const lastEventOf = async (defectId: string) =>
  (await journalOf(db, { aggregateId: defectId })).map((entry) => [entry.type, entry.actor, entry.data]).at(-1);

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("CMD-PrioritizeDefect", () => {
  it("ST-027: Technician raises the priority", async () => {
    const { machineId, defectId } = await anOpenDefect("Display flickers");
    expect((await defectDetails(db, defectId))?.priority).toBe("normal");

    expect(await prioritize(defectId, 0, "high", tom)).toEqual({ ok: true, result: { defectId } });

    expect((await defectDetails(db, defectId))?.priority).toBe("high");
    // The open defects list shows it among the high-priority defects.
    expect((await openDefects(db, { machineId, priority: "high" })).map((entry) => entry.title)).toEqual([
      "Display flickers",
    ]);
    expect(await openDefects(db, { machineId, priority: "normal" })).toEqual([]);
    expect(await lastEventOf(defectId)).toEqual(["EVT-DefectPrioritized", tom, { priority: "high" }]);
  });
});

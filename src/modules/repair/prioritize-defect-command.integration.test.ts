import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { anOpenDefectIn } from "@/test-support/defects";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { defectDetails, openDefects, prioritizeDefectCommand, resolveDefectCommand, type Priority } from ".";

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

/** A defect that was open and is resolved now – at version 1. */
async function aResolvedDefect(title: string) {
  const { defectId } = await anOpenDefect(title);
  const resolved = await executeCommand(
    resolveDefectCommand,
    { defectId, version: 0, closingNote: "Door realigned." },
    { actor: tom, db, clock: fixedClock("2026-10-14T09:00:00Z"), newId: randomUUID },
  );
  if (!resolved.ok) throw new Error(resolved.error);
  return defectId;
}

const journalLength = async (defectId: string) => (await journalOf(db, { aggregateId: defectId })).length;

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

  it("ST-027: Resolved defects cannot be prioritized", async () => {
    const defectId = await aResolvedDefect("Coin door jammed");
    const journalBefore = await journalLength(defectId);

    expect(await prioritize(defectId, 1, "high", tom)).toEqual({ ok: false, error: "defect-not-open" });

    expect((await defectDetails(db, defectId))?.priority).toBe("normal");
    expect(await journalLength(defectId)).toBe(journalBefore);
  });

  it("ST-027: Helpers cannot prioritize", async () => {
    const { defectId } = await anOpenDefect("Rubber cracked");
    const journalBefore = await journalLength(defectId);

    expect(await prioritize(defectId, 0, "high", anna)).toEqual({ ok: false, error: "not-authorized" });

    expect((await defectDetails(db, defectId))?.priority).toBe("normal");
    expect(await journalLength(defectId)).toBe(journalBefore);
  });

  it("needs a priority other than the one the defect has, chosen on the version the technician saw", async () => {
    const { defectId } = await anOpenDefect("Display flickers");

    expect(await prioritize(defectId, 0, undefined, tom)).toEqual({ ok: false, error: "priority-required" });
    expect(await prioritize(defectId, 0, "normal", tom)).toEqual({ ok: false, error: "priority-unchanged" });
    expect(await prioritize(defectId, 0, "low", tom)).toEqual({ ok: true, result: { defectId } });
    // Someone who saw it before it was lowered does not raise it unseen.
    expect(await prioritize(defectId, 0, "high", tom)).toEqual({ ok: false, error: "version-conflict" });
    expect((await defectDetails(db, defectId))?.priority).toBe("low");
  });
});

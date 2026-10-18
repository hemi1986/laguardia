import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { anOpenDefectIn } from "@/test-support/defects";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  changeDefectDetailsCommand,
  claimDefectCommand,
  defectDetails,
  openDefectTitles,
  resolveDefectCommand,
} from ".";

/**
 * CMD-ChangeDefectDetails (ST-031) through the command layer: a technician changes the title or the suitable-for-helpers
 * mark of an open defect.
 */
const db = testDatabase();
const recorded = fixedClock("2026-10-18T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect on a machine of its own – at version 0. */
const anOpenDefect = (title: string, suitableForHelpers = false) =>
  anOpenDefectIn(db, { title, suitableForHelpers, recordedBy: tom, at: recorded });

const dependencies = (actor: Actor, at: string) => ({ actor, db, clock: fixedClock(at), newId: randomUUID });

function change(
  defectId: string,
  version: number,
  details: { title: string; suitableForHelpers: boolean },
  actor: Actor,
) {
  return executeCommand(
    changeDefectDetailsCommand,
    { defectId, version, ...details },
    dependencies(actor, "2026-10-18T10:00:00Z"),
  );
}

const journalLength = async (defectId: string) => (await journalOf(db, { aggregateId: defectId })).length;

/** A defect that was open and is resolved now – at version 1. */
async function aResolvedDefect(title: string) {
  const { defectId } = await anOpenDefect(title);
  const resolved = await executeCommand(
    resolveDefectCommand,
    { defectId, version: 0, closingNote: "Door realigned." },
    dependencies(tom, "2026-10-18T09:00:00Z"),
  );
  if (!resolved.ok) throw new Error(resolved.error);
  return defectId;
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("CMD-ChangeDefectDetails", () => {
  it("ST-031: Technician changes the title", async () => {
    const { machineId, defectId } = await anOpenDefect("EOS sw. L fl.");

    expect(await change(defectId, 0, { title: " Left flipper weak ", suitableForHelpers: false }, tom)).toEqual({
      ok: true,
      result: { defectId },
    });

    expect((await defectDetails(db, defectId))?.title).toBe("Left flipper weak");
    // The visitor machine page of its machine shows the new title.
    expect(await openDefectTitles(db, machineId)).toEqual(["Left flipper weak"]);
  });

  it("ST-031: Technician marks a defect as suitable for helpers", async () => {
    const { defectId } = await anOpenDefect("Rubber cracked", false);
    expect(
      await executeCommand(claimDefectCommand, { defectId, version: 0 }, dependencies(anna, "2026-10-18T09:00:00Z")),
    ).toEqual({ ok: false, error: "not-suitable-for-helpers" });

    expect(await change(defectId, 0, { title: "Rubber cracked", suitableForHelpers: true }, tom)).toMatchObject({
      ok: true,
    });

    expect((await defectDetails(db, defectId))?.suitableForHelpers).toBe(true);
    // Helpers can claim and resolve it now.
    expect(
      await executeCommand(claimDefectCommand, { defectId, version: 1 }, dependencies(anna, "2026-10-18T11:00:00Z")),
    ).toMatchObject({ ok: true });
    expect(
      await executeCommand(
        resolveDefectCommand,
        { defectId, version: 2, closingNote: "Rubber replaced" },
        dependencies(anna, "2026-10-18T12:00:00Z"),
      ),
    ).toMatchObject({ ok: true });
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
  });

  it("ST-031: Title is required", async () => {
    const { defectId } = await anOpenDefect("Display flickers");
    const journalBefore = await journalLength(defectId);

    expect(await change(defectId, 0, { title: "   ", suitableForHelpers: false }, tom)).toEqual({
      ok: false,
      error: "title-required",
    });
    expect((await defectDetails(db, defectId))?.title).toBe("Display flickers");
    expect(await journalLength(defectId)).toBe(journalBefore);
  });

  it("ST-031: Resolved defects cannot be changed", async () => {
    const defectId = await aResolvedDefect("Coin door jammed");
    const journalBefore = await journalLength(defectId);

    expect(await change(defectId, 1, { title: "Coin door stuck", suitableForHelpers: false }, tom)).toEqual({
      ok: false,
      error: "defect-not-open",
    });
    expect((await defectDetails(db, defectId))?.title).toBe("Coin door jammed");
    expect(await journalLength(defectId)).toBe(journalBefore);
  });

  it("ST-031: Helpers cannot change defect details", async () => {
    const { defectId } = await anOpenDefect("Display flickers", true);

    expect(await change(defectId, 0, { title: "Display dark", suitableForHelpers: true }, anna)).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect((await defectDetails(db, defectId))?.title).toBe("Display flickers");
  });

  it("rejects a change that changes nothing – every successful command records a fact", async () => {
    const { defectId } = await anOpenDefect("Display flickers");
    const journalBefore = await journalLength(defectId);

    expect(await change(defectId, 0, { title: " Display flickers ", suitableForHelpers: false }, tom)).toEqual({
      ok: false,
      error: "details-unchanged",
    });
    expect(await journalLength(defectId)).toBe(journalBefore);
  });
});

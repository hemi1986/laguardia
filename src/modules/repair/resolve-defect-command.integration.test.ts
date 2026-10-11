import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { machineForReporting, type MachineStatus } from "@/modules/collection";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  claimDefectCommand,
  defectDetails,
  openDefects,
  openDefectTitles,
  reportProblemAndTriageCommand,
  resolveDefectCommand,
} from ".";

/** CMD-ResolveDefect (ST-028) through the command layer: a team member resolves a defect with a closing note. */
const db = testDatabase();
const recorded = fixedClock("2026-10-12T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect on a machine of its own, reported and recorded by Tom (ST-023). */
async function anOpenDefect(title: string, suitableForHelpers = false, machineStatus: MachineStatus = "playable") {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  const machineId = await aRegisteredMachine(db, machineStatus);
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: `${title} – first seen`,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock: recorded, newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return { machineId, defectId: reported.result.defectId };
}

function resolve(defectId: string, version: number, closingNote: string, actor: Actor, at = "2026-10-13T10:00:00Z") {
  return executeCommand(
    resolveDefectCommand,
    { defectId, version, closingNote },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

describe("CMD-ResolveDefect", () => {
  it("ST-028: Technician resolves a defect", async () => {
    const { machineId, defectId } = await anOpenDefect("Left flipper weak");
    const claimed = await executeCommand(
      claimDefectCommand,
      { defectId, version: 0 },
      { actor: tom, db, clock: fixedClock("2026-10-12T09:00:00Z"), newId: randomUUID },
    );
    if (!claimed.ok) throw new Error("not claimed");
    expect(await openDefectTitles(db, machineId)).toEqual(["Left flipper weak"]);

    const resolved = await resolve(defectId, 1, "  Coil stop replaced, flipper tested for 20 minutes ", tom);

    expect(resolved).toEqual({ ok: true, result: { defectId } });
    expect(await defectDetails(db, defectId)).toMatchObject({
      state: "resolved",
      resolution: {
        closingNote: "Coil stop replaced, flipper tested for 20 minutes",
        resolvedBy: tom.teamMemberId,
        resolvedAt: new Date("2026-10-13T10:00:00Z"),
      },
      // It is no longer claimed.
      claim: undefined,
    });
    // Neither in the open defects list nor on the visitor machine page.
    expect(await openDefects(db, { machineId })).toEqual([]);
    expect(await openDefectTitles(db, machineId)).toEqual([]);
    // The journal names who resolved it – never the closing note, which is free text.
    const journal = await journalOf(db, { aggregateId: defectId });
    expect(journal.map((entry) => [entry.type, entry.actor, entry.machineId, entry.data]).at(-1)).toEqual([
      "EVT-DefectResolved",
      tom,
      machineId,
      { resolvedBy: tom.teamMemberId },
    ]);
  });

  it("ST-028: Helper resolves a defect suitable for helpers", async () => {
    const { machineId, defectId } = await anOpenDefect("Rubber cracked", true);

    // Anna has not claimed it – a claim is a signal, not a lock (HS-8).
    expect(await resolve(defectId, 0, "Rubber replaced", anna)).toEqual({ ok: true, result: { defectId } });

    expect(await defectDetails(db, defectId)).toMatchObject({
      state: "resolved",
      resolution: { closingNote: "Rubber replaced", resolvedBy: anna.teamMemberId },
    });
    expect(await openDefects(db, { machineId })).toEqual([]);
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)).toMatchObject({
      type: "EVT-DefectResolved",
      actor: anna,
      data: { resolvedBy: anna.teamMemberId },
    });
  });

  it("ST-028: Helpers cannot resolve defects not suitable for helpers", async () => {
    const { machineId, defectId } = await anOpenDefect("Display flickers");

    expect(await resolve(defectId, 0, "Display cable plugged in again", anna)).toEqual({
      ok: false,
      error: "not-suitable-for-helpers",
    });

    // It stays open, without a resolution, and nothing was journaled.
    expect(await defectDetails(db, defectId)).toMatchObject({ state: "open", resolution: undefined });
    expect((await openDefects(db, { machineId })).map((defect) => defect.title)).toEqual(["Display flickers"]);
    expect(await openDefectTitles(db, machineId)).toEqual(["Display flickers"]);
    expect(await journalOf(db, { aggregateId: defectId })).toEqual([]);
  });

  it("ST-028: A closing note is required", async () => {
    const { machineId, defectId } = await anOpenDefect("Left flipper weak");

    for (const closingNote of ["", "   \n "]) {
      expect(await resolve(defectId, 0, closingNote, tom)).toEqual({ ok: false, error: "closing-note-required" });
    }

    expect(await defectDetails(db, defectId)).toMatchObject({ state: "open", resolution: undefined });
    expect(await openDefectTitles(db, machineId)).toEqual(["Left flipper weak"]);
    expect(await journalOf(db, { aggregateId: defectId })).toEqual([]);
  });

  it("ST-028: A resolved defect cannot be resolved again", async () => {
    const { defectId } = await anOpenDefect("Coin door jammed", true);
    const first = await resolve(defectId, 0, "Lock replaced", tom, "2026-10-13T10:00:00Z");
    if (!first.ok) throw new Error(first.error);
    const journalBefore = await journalOf(db, { aggregateId: defectId });

    for (const teamMember of [tom, anna]) {
      expect(await resolve(defectId, 1, "Lock oiled as well", teamMember, "2026-10-14T10:00:00Z")).toEqual({
        ok: false,
        error: "defect-not-open",
      });
    }

    // How it ended stays as it was – a resolved defect can only be reopened.
    expect((await defectDetails(db, defectId))?.resolution).toEqual({
      closingNote: "Lock replaced",
      resolvedBy: tom.teamMemberId,
      resolvedAt: new Date("2026-10-13T10:00:00Z"),
    });
    expect(await journalOf(db, { aggregateId: defectId })).toEqual(journalBefore);
  });
});

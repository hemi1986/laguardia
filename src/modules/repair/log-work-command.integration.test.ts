import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  claimDefectCommand,
  defectDetails,
  logWorkCommand,
  openDefects,
  reportProblemAndTriageCommand,
  resolveDefectCommand,
} from ".";
import { tamperWithWorkLogForTest } from "./problem-report-stand-ins.test-support";

/** CMD-LogWork (ST-024) through the command layer: a team member logs what they did on a defect. */
const db = testDatabase();
const recorded = fixedClock("2026-10-12T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect on a machine of its own, reported and recorded by Tom (ST-023). */
async function anOpenDefect(title: string, suitableForHelpers = false) {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  const machineId = await aRegisteredMachine(db);
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

function logWork(
  defectId: string,
  version: number,
  work: { whatWasDone: string; partsUsed?: string },
  actor: Actor,
  at = "2026-10-13T10:00:00Z",
) {
  return executeCommand(
    logWorkCommand,
    { defectId, version, whatWasDone: work.whatWasDone, partsUsed: work.partsUsed ?? "" },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

describe("CMD-LogWork", () => {
  it("ST-024: Team member logs work", async () => {
    const { machineId, defectId } = await anOpenDefect("Left flipper weak");
    expect((await openDefects(db, { machineId }))[0].lastWorkLogEntry).toBeUndefined();

    const logged = await logWork(
      defectId,
      0,
      { whatWasDone: "  Replaced coil stop and EOS switch ", partsUsed: " 1x coil stop, 1x EOS switch " },
      tom,
    );

    expect(logged).toEqual({ ok: true, result: { defectId } });
    const details = await defectDetails(db, defectId);
    expect(details).toMatchObject({ state: "open", version: 1 });
    expect(details?.workLog).toEqual([
      {
        id: expect.any(String),
        whatWasDone: "Replaced coil stop and EOS switch",
        partsUsed: "1x coil stop, 1x EOS switch",
        loggedBy: tom.teamMemberId,
        loggedAt: new Date("2026-10-13T10:00:00Z"),
      },
    ]);
    // The open defects list shows it as the last work log entry of "Left flipper weak".
    const [listed] = await openDefects(db, { machineId });
    expect(listed).toMatchObject({
      title: "Left flipper weak",
      lastWorkLogEntry: { loggedBy: tom.teamMemberId, loggedAt: new Date("2026-10-13T10:00:00Z") },
    });
    // The journal refers to the entry and who logged it – never to what was typed.
    const entry = (await journalOf(db, { aggregateId: defectId })).at(-1);
    expect([entry?.type, entry?.actor, entry?.machineId, entry?.data]).toEqual([
      "EVT-WorkLogged",
      tom,
      machineId,
      { workLogEntryId: details?.workLog[0].id, loggedBy: tom.teamMemberId },
    ]);
  });

  it("ST-024: Helper logs work without claim on a defect not suitable for helpers", async () => {
    const { machineId, defectId } = await anOpenDefect("Display flickers");
    expect(await defectDetails(db, defectId)).toMatchObject({ suitableForHelpers: false, claim: undefined });

    const logged = await logWork(
      defectId,
      0,
      { whatWasDone: "Reseated the display connector, flicker still there" },
      anna,
    );

    expect(logged).toEqual({ ok: true, result: { defectId } });
    const details = await defectDetails(db, defectId);
    expect(details?.workLog).toMatchObject([
      {
        whatWasDone: "Reseated the display connector, flicker still there",
        // No parts were used.
        partsUsed: undefined,
        loggedBy: anna.teamMemberId,
      },
    ]);
    // Logging work is not claiming: the defect stays unclaimed.
    expect(details?.claim).toBeUndefined();
    expect((await openDefects(db, { machineId }))[0].lastWorkLogEntry?.loggedBy).toBe(anna.teamMemberId);
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)).toMatchObject({
      type: "EVT-WorkLogged",
      actor: anna,
    });
  });

  it("ST-024: What was done is required", async () => {
    const { machineId, defectId } = await anOpenDefect("Left flipper weak");

    for (const whatWasDone of ["", "  \n "]) {
      expect(await logWork(defectId, 0, { whatWasDone, partsUsed: "1x coil stop" }, tom)).toEqual({
        ok: false,
        error: "what-was-done-required",
      });
    }

    expect((await defectDetails(db, defectId))?.workLog).toEqual([]);
    expect((await openDefects(db, { machineId }))[0].lastWorkLogEntry).toBeUndefined();
    expect(await journalOf(db, { aggregateId: defectId })).toEqual([]);
  });

  it("ST-024: No work on resolved defects", async () => {
    const { defectId } = await anOpenDefect("Coin door jammed", true);
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Lock replaced" },
      { actor: tom, db, clock: fixedClock("2026-10-13T09:00:00Z"), newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);
    const journalBefore = await journalOf(db, { aggregateId: defectId });

    for (const teamMember of [tom, anna]) {
      expect(await logWork(defectId, 1, { whatWasDone: "Oiled the lock as well" }, teamMember)).toEqual({
        ok: false,
        error: "defect-not-open",
      });
    }

    expect((await defectDetails(db, defectId))?.workLog).toEqual([]);
    expect(await journalOf(db, { aggregateId: defectId })).toEqual(journalBefore);
  });

  it("ST-024: Work log entries cannot be changed", async () => {
    const { defectId } = await anOpenDefect("Left flipper weak", true);
    await logWork(defectId, 0, { whatWasDone: "Replaced coil stop", partsUsed: "1x coil stop" }, tom);
    const [byTom] = (await defectDetails(db, defectId))!.workLog;
    expect(byTom).toMatchObject({ whatWasDone: "Replaced coil stop", loggedBy: tom.teamMemberId });
    const run = { db, clock: fixedClock("2026-10-14T10:00:00Z"), newId: randomUUID };

    // Anyone tries – through a command that does what no command of the module does: rewrite the entry, then drop it.
    for (const [version, actor, attempt] of [
      [1, anna, "change"],
      [2, tom, "change"],
      [3, anna, "remove"],
      [4, tom, "remove"],
    ] as const) {
      const tried = await executeCommand(tamperWithWorkLogForTest, { defectId, version, attempt }, { actor, ...run });
      expect(tried.ok).toBe(true);
      expect((await defectDetails(db, defectId))?.workLog).toEqual([byTom]);
    }

    // And everything that does happen to the defect afterwards leaves it as it is – stored once, never written again.
    await db.transaction(async (tx) => {
      const unchanged = () =>
        tx.execute(sql`SELECT xmin::text AS written FROM defect_work_log_entry WHERE id = ${byTom.id}`);
      const before = (await unchanged()).rows;
      const later = { db: tx, clock: fixedClock("2026-10-15T10:00:00Z"), newId: randomUUID };
      const more = await executeCommand(
        logWorkCommand,
        { defectId, version: 5, whatWasDone: "Adjusted EOS switch", partsUsed: "" },
        { actor: anna, ...later },
      );
      const claimed = await executeCommand(claimDefectCommand, { defectId, version: 6 }, { actor: anna, ...later });
      const resolved = await executeCommand(
        resolveDefectCommand,
        { defectId, version: 7, closingNote: "Flipper tested" },
        { actor: anna, ...later },
      );
      expect([more.ok, claimed.ok, resolved.ok]).toEqual([true, true, true]);
      expect((await unchanged()).rows).toEqual(before);
      expect((await defectDetails(tx, defectId))?.workLog).toEqual([
        byTom,
        expect.objectContaining({ whatWasDone: "Adjusted EOS switch", loggedBy: anna.teamMemberId }),
      ]);
    });
  });
});

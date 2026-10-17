import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { deactivateAccount } from "@/modules/team";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { defectDetails, claimDefectCommand, lastDefectActionBy, openDefects, resolveDefectCommand } from ".";
import { anOpenDefectIn } from "@/test-support/defects";

/** CMD-ClaimDefect (ST-025) through the command layer: a team member claims a defect or takes it over. */
const db = testDatabase();
const recorded = fixedClock("2026-10-12T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect on a machine of its own, reported and recorded by Tom (ST-023). */
const anOpenDefect = (title: string, suitableForHelpers = false) =>
  anOpenDefectIn(db, { title, suitableForHelpers, recordedBy: tom, at: recorded });

function claim(defectId: string, version: number, actor: Actor, at: string) {
  return executeCommand(
    claimDefectCommand,
    { defectId, version },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

/** A technician assigns the defect to a team member (ST-026) – CMD-ClaimDefect with the team member to assign it to. */
function assign(defectId: string, version: number, actor: Actor, assignTo: { teamMemberId: string }, at: string) {
  return executeCommand(
    claimDefectCommand,
    { defectId, version, assignTo: assignTo.teamMemberId },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

/** Who the open defects list names as the defect's claimant (RM-OpenDefects). */
async function claimantOf(machineId: string) {
  const [entry] = await openDefects(db, { machineId });
  return entry.claimedBy;
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, ben, "Ben");
});

describe("CMD-ClaimDefect", () => {
  it("ST-025: Taking over a claimed defect", async () => {
    const { machineId, defectId } = await anOpenDefect("Rubber cracked", true);
    expect(await claim(defectId, 0, tom, "2026-10-12T09:00:00Z")).toEqual({
      ok: true,
      result: { defectId },
    });
    expect(await claimantOf(machineId)).toBe(tom.teamMemberId);

    const takenOver = await claim(defectId, 1, anna, "2026-10-12T10:00:00Z");

    expect(takenOver).toEqual({ ok: true, result: { defectId } });
    expect((await lastDefectActionBy(db, defectId, anna.teamMemberId))?.takenOverFrom).toBe(tom.teamMemberId);
    // … asked only of the claimant the event made: for anyone else it says nothing.
    expect(await lastDefectActionBy(db, defectId, tom.teamMemberId)).toBeUndefined();
    // Anna is its claimant – Tom no longer is: a defect has at most one.
    expect(await claimantOf(machineId)).toBe(anna.teamMemberId);
    expect((await defectDetails(db, defectId))?.claim).toEqual({
      claimedBy: anna.teamMemberId,
      claimedAt: new Date("2026-10-12T10:00:00Z"),
    });
    expect(
      (await journalOf(db, { aggregateId: defectId })).map((entry) => [entry.type, entry.actor, entry.data]),
    ).toEqual([
      ["EVT-DefectClaimed", tom, { claimedBy: tom.teamMemberId }],
      ["EVT-DefectClaimed", anna, { claimedBy: anna.teamMemberId, takenOverFrom: tom.teamMemberId }],
    ]);
  });

  it("ST-025: Helpers can only claim defects suitable for helpers", async () => {
    const unclaimed = await anOpenDefect("Display flickers");
    const claimedByTom = await anOpenDefect("Display flickers");
    await claim(claimedByTom.defectId, 0, tom, "2026-10-12T09:00:00Z");
    const journalBefore = (await journalOf(db, { aggregateId: claimedByTom.defectId })).length;

    expect(await claim(unclaimed.defectId, 0, anna, "2026-10-12T10:00:00Z")).toEqual({
      ok: false,
      error: "not-suitable-for-helpers",
    });
    expect(await claim(claimedByTom.defectId, 1, anna, "2026-10-12T10:00:00Z")).toEqual({
      ok: false,
      error: "not-suitable-for-helpers",
    });

    // Each keeps its claimant, if any.
    expect(await claimantOf(unclaimed.machineId)).toBeUndefined();
    expect(await claimantOf(claimedByTom.machineId)).toBe(tom.teamMemberId);
    expect(await journalOf(db, { aggregateId: unclaimed.defectId })).toEqual([]);
    expect(await journalOf(db, { aggregateId: claimedByTom.defectId })).toHaveLength(journalBefore);
  });

  it("ST-025: Resolved defects cannot be claimed", async () => {
    const { defectId } = await anOpenDefect("Coin door jammed", true);
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Fixed" },
      { actor: tom, db, clock: recorded, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error("not resolved");

    for (const teamMember of [tom, anna]) {
      expect(await claim(defectId, 1, teamMember, "2026-10-12T10:00:00Z")).toEqual({
        ok: false,
        error: "defect-not-open",
      });
    }
    expect((await defectDetails(db, defectId))?.claim).toBeUndefined();
  });

  it("rejects claiming one's own claim again and keeps since when it is claimed", async () => {
    const { defectId } = await anOpenDefect("Left flipper weak");
    await claim(defectId, 0, tom, "2026-10-12T09:00:00Z");

    expect(await claim(defectId, 1, tom, "2026-10-20T09:00:00Z")).toEqual({
      ok: false,
      error: "already-claimed-by-you",
    });
    expect((await defectDetails(db, defectId))?.claim?.claimedAt).toEqual(new Date("2026-10-12T09:00:00Z"));
  });

  it("ST-026: Technician assigns a defect to a helper", async () => {
    const { machineId, defectId } = await anOpenDefect("Rubber cracked", true);

    const assigned = await assign(defectId, 0, tom, anna, "2026-10-12T09:00:00Z");

    expect(assigned).toEqual({ ok: true, result: { defectId } });
    expect(await claimantOf(machineId)).toBe(anna.teamMemberId);
    expect((await defectDetails(db, defectId))?.claim).toEqual({
      claimedBy: anna.teamMemberId,
      assignedBy: tom.teamMemberId,
      claimedAt: new Date("2026-10-12T09:00:00Z"),
    });
    expect(
      (await journalOf(db, { aggregateId: defectId })).map((entry) => [entry.type, entry.actor, entry.data]),
    ).toEqual([["EVT-DefectClaimed", tom, { claimedBy: anna.teamMemberId, assignedBy: tom.teamMemberId }]]);
  });

  it("ST-026: Helpers cannot be assigned defects not suitable for helpers", async () => {
    const { machineId, defectId } = await anOpenDefect("Display flickers");

    expect(await assign(defectId, 0, tom, anna, "2026-10-12T09:00:00Z")).toEqual({
      ok: false,
      error: "not-suitable-for-helpers",
    });

    expect(await claimantOf(machineId)).toBeUndefined();
    expect(await journalOf(db, { aggregateId: defectId })).toEqual([]);
  });

  it("ST-026: Helpers cannot assign defects to others", async () => {
    const { machineId, defectId } = await anOpenDefect("Rubber cracked", true);

    expect(await assign(defectId, 0, anna, ben, "2026-10-12T09:00:00Z")).toEqual({
      ok: false,
      error: "not-authorized",
    });

    expect(await claimantOf(machineId)).toBeUndefined();
    expect(await journalOf(db, { aggregateId: defectId })).toEqual([]);
  });

  it("assigns a claimed defect to someone else as a takeover, and names who had it (ST-026)", async () => {
    const { machineId, defectId } = await anOpenDefect("Rubber cracked", true);
    await claim(defectId, 0, anna, "2026-10-12T09:00:00Z");

    expect(await assign(defectId, 1, tom, ben, "2026-10-12T10:00:00Z")).toEqual({ ok: true, result: { defectId } });

    expect(await claimantOf(machineId)).toBe(ben.teamMemberId);
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)?.data).toEqual({
      claimedBy: ben.teamMemberId,
      takenOverFrom: anna.teamMemberId,
      assignedBy: tom.teamMemberId,
    });
    // Claiming it oneself afterwards is no assignment any more.
    await claim(defectId, 2, anna, "2026-10-12T11:00:00Z");
    expect((await defectDetails(db, defectId))?.claim).toEqual({
      claimedBy: anna.teamMemberId,
      claimedAt: new Date("2026-10-12T11:00:00Z"),
    });
    expect((await defectDetails(db, defectId))?.claim).not.toHaveProperty("assignedBy");
  });

  it("assigns to nobody without an active account, and never turns an empty choice into a claim (ST-026)", async () => {
    const { machineId, defectId } = await anOpenDefect("Rubber cracked", true);
    const gone = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, gone, "Gone");
    const deactivated = await deactivateAccount({ teamMemberId: gone.teamMemberId }, { db, actor: tom });
    if (!deactivated.ok) throw new Error(deactivated.error);

    for (const [assignTo, error] of [
      [gone.teamMemberId, "team-member-not-active"],
      // An ID in another spelling is nobody – not Tom himself, not Anna: nothing but Team's spelling is stored.
      [tom.teamMemberId.toUpperCase(), "team-member-not-active"],
      [anna.teamMemberId.toUpperCase(), "team-member-not-active"],
      [randomUUID(), "team-member-not-active"],
      ["not an ID", "team-member-not-active"],
      ["", "team-member-required"],
    ]) {
      expect(await assign(defectId, 0, tom, { teamMemberId: assignTo }, "2026-10-12T09:00:00Z")).toEqual({
        ok: false,
        error,
      });
    }
    expect(await claimantOf(machineId)).toBeUndefined();
  });

  it("assigns no defect that is resolved (ST-026)", async () => {
    const { defectId } = await anOpenDefect("Coin door jammed", true);
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Fixed" },
      { actor: tom, db, clock: recorded, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error("not resolved");

    expect(await assign(defectId, 1, tom, anna, "2026-10-12T10:00:00Z")).toEqual({
      ok: false,
      error: "defect-not-open",
    });
    expect((await defectDetails(db, defectId))?.claim).toBeUndefined();
  });

  it("is not for visitors", async () => {
    const { defectId } = await anOpenDefect("Left flipper weak", true);

    expect(await claim(defectId, 0, { kind: "visitor" }, "2026-10-12T09:00:00Z")).toEqual({
      ok: false,
      error: "not-authorized",
    });
  });
});

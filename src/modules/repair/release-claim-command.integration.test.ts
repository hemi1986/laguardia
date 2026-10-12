import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { anOpenDefectIn } from "@/test-support/defects";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { claimDefectCommand, defectDetails, openDefects, releaseClaimCommand } from ".";

/** CMD-ReleaseClaim (ST-026) through the command layer: a claim ends without the defect being resolved. */
const db = testDatabase();
const recorded = fixedClock("2026-10-12T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect on a machine of its own, claimed by the given team member – at version 1. */
async function aDefectClaimedBy(claimant: typeof tom | typeof anna, title: string) {
  const defect = await anOpenDefectIn(db, { title, suitableForHelpers: true, recordedBy: tom, at: recorded });
  const claimed = await executeCommand(
    claimDefectCommand,
    { defectId: defect.defectId, version: 0 },
    { actor: claimant, db, clock: fixedClock("2026-10-12T09:00:00Z"), newId: randomUUID },
  );
  if (!claimed.ok) throw new Error("not claimed");
  return defect;
}

function release(defectId: string, version: number, actor: Actor) {
  return executeCommand(
    releaseClaimCommand,
    { defectId, version },
    { actor, db, clock: fixedClock("2026-10-12T10:00:00Z"), newId: randomUUID },
  );
}

/** Who the open defects list names as the defect's claimant (RM-OpenDefects). */
async function claimantOf(machineId: string) {
  const [entry] = await openDefects(db, { machineId });
  return entry.claimedBy;
}

const lastEventOf = async (defectId: string) =>
  (await journalOf(db, { aggregateId: defectId })).map((entry) => [entry.type, entry.actor, entry.data]).at(-1);

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("CMD-ReleaseClaim", () => {
  it("ST-026: Team member releases their own claim", async () => {
    const { machineId, defectId } = await aDefectClaimedBy(anna, "Rubber cracked");

    expect(await release(defectId, 1, anna)).toEqual({ ok: true, result: { defectId } });

    expect(await claimantOf(machineId)).toBeUndefined();
    expect((await defectDetails(db, defectId))?.claim).toBeUndefined();
    // The defect stays open, and can be claimed again.
    expect((await defectDetails(db, defectId))?.state).toBe("open");
    expect(await lastEventOf(defectId)).toEqual(["EVT-DefectClaimReleased", anna, {}]);
  });

  it("ST-026: Helpers cannot release someone else's claim", async () => {
    const { machineId, defectId } = await aDefectClaimedBy(tom, "Left flipper weak");
    const journalBefore = (await journalOf(db, { aggregateId: defectId })).length;

    expect(await release(defectId, 1, anna)).toEqual({ ok: false, error: "not-your-claim" });

    expect(await claimantOf(machineId)).toBe(tom.teamMemberId);
    expect((await defectDetails(db, defectId))?.claim).toEqual({
      claimedBy: tom.teamMemberId,
      claimedAt: new Date("2026-10-12T09:00:00Z"),
    });
    expect(await journalOf(db, { aggregateId: defectId })).toHaveLength(journalBefore);
  });

  it("ST-026: Technician releases any claim", async () => {
    const { machineId, defectId } = await aDefectClaimedBy(anna, "Rubber cracked");

    expect(await release(defectId, 1, eva)).toEqual({ ok: true, result: { defectId } });

    expect(await claimantOf(machineId)).toBeUndefined();
    expect((await defectDetails(db, defectId))?.claim).toBeUndefined();
    expect(await lastEventOf(defectId)).toEqual(["EVT-DefectClaimReleased", eva, {}]);
  });

  it("releases nothing that is not claimed, and not a claim someone took over meanwhile", async () => {
    const unclaimed = await anOpenDefectIn(db, { suitableForHelpers: true, recordedBy: tom, at: recorded });
    expect(await release(unclaimed.defectId, 0, tom)).toEqual({ ok: false, error: "not-claimed" });

    // Anna saw her own claim (version 1); Tom took it over before she released it.
    const { machineId, defectId } = await aDefectClaimedBy(anna, "Rubber cracked");
    await executeCommand(
      claimDefectCommand,
      { defectId, version: 1 },
      { actor: tom, db, clock: fixedClock("2026-10-12T09:30:00Z"), newId: randomUUID },
    );
    expect(await release(defectId, 1, anna)).toEqual({ ok: false, error: "not-your-claim" });
    expect(await claimantOf(machineId)).toBe(tom.teamMemberId);
  });

  it("is not for visitors", async () => {
    const { defectId } = await aDefectClaimedBy(anna, "Rubber cracked");

    expect(await release(defectId, 1, { kind: "visitor" })).toEqual({ ok: false, error: "not-authorized" });
  });
});

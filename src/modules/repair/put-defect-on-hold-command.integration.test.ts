import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { anOpenDefectIn } from "@/test-support/defects";
import { claimDefectCommand, defectDetails, openDefects, putDefectOnHoldCommand, type HoldReason } from ".";

/** CMD-PutDefectOnHold (ST-029) through the command layer: an open defect waits, with a reason. */
const db = testDatabase();
const recorded = fixedClock("2026-10-12T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect on a machine of its own, reported and recorded by Tom (ST-023). */
const anOpenDefect = (title: string, suitableForHelpers = true) =>
  anOpenDefectIn(db, { title, suitableForHelpers, machineStatus: "playable", recordedBy: tom, at: recorded });

async function aDefectClaimedBy(claimant: Actor & { kind: "team-member" }, title: string) {
  const defect = await anOpenDefect(title);
  const claimed = await executeCommand(
    claimDefectCommand,
    { defectId: defect.defectId, version: 0 },
    { actor: claimant, db, clock: fixedClock("2026-10-12T09:00:00Z"), newId: randomUUID },
  );
  if (!claimed.ok) throw new Error(`not claimed: ${claimed.error}`);
  return defect;
}

function putOnHold(
  defectId: string,
  version: number,
  reason: HoldReason | undefined,
  actor: Actor,
  note?: string,
  at = "2026-10-13T10:00:00Z",
) {
  return executeCommand(
    putDefectOnHoldCommand,
    { defectId, version, reason, note },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, ben, "Ben");
});

describe("CMD-PutDefectOnHold", () => {
  it("ST-029: Claimant puts a defect on hold", async () => {
    const { machineId, defectId } = await aDefectClaimedBy(anna, "Display flickers");

    const held = await putOnHold(defectId, 1, "waiting-for-part", anna, "  Ordered new flyback ");

    expect(held).toEqual({ ok: true, result: { defectId } });
    expect((await defectDetails(db, defectId))?.hold).toEqual({
      reason: "waiting-for-part",
      note: "Ordered new flyback",
      heldAt: new Date("2026-10-13T10:00:00Z"),
    });
    // The defect stays open and claimed – on hold is a part of open (data model).
    expect(await openDefects(db, { machineId })).toMatchObject([
      { title: "Display flickers", claimedBy: anna.teamMemberId, hold: { reason: "waiting-for-part" } },
    ]);
    // The journal names the reason, a fact from a fixed list – never the note, which is typed text (ST-003).
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)).toMatchObject({
      type: "EVT-DefectPutOnHold",
      actor: anna,
      data: { reason: "waiting-for-part" },
    });
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)?.data).not.toHaveProperty("note");
  });

  it("ST-029: Technician puts an unclaimed defect on hold", async () => {
    const { defectId } = await anOpenDefect("Left flipper weak", false);

    expect(await putOnHold(defectId, 0, "waiting-for-technician", tom)).toEqual({ ok: true, result: { defectId } });

    expect(await defectDetails(db, defectId)).toMatchObject({
      state: "open",
      claim: undefined,
      hold: { reason: "waiting-for-technician", note: undefined },
    });
  });

  it("ST-029: Others cannot put a defect on hold", async () => {
    const { defectId } = await aDefectClaimedBy(anna, "Display flickers");
    const journalBefore = (await journalOf(db, { aggregateId: defectId })).length;

    expect(await putOnHold(defectId, 1, "waiting-for-part", ben)).toEqual({ ok: false, error: "not-claimant" });

    expect((await defectDetails(db, defectId))?.hold).toBeUndefined();
    expect(await journalOf(db, { aggregateId: defectId })).toHaveLength(journalBefore);
  });

  it("ST-029: A reason is required", async () => {
    const { defectId } = await anOpenDefect("Coin door sticks");

    expect(await putOnHold(defectId, 0, undefined, tom, "Waiting")).toEqual({
      ok: false,
      error: "hold-reason-required",
    });
    expect((await defectDetails(db, defectId))?.hold).toBeUndefined();
  });

  it("ST-029: A defect on hold cannot be put on hold again", async () => {
    const { defectId } = await anOpenDefect("Display flickers");
    if (!(await putOnHold(defectId, 0, "waiting-for-part", tom)).ok) throw new Error("not on hold");

    expect(await putOnHold(defectId, 1, "other", tom, "Again")).toEqual({ ok: false, error: "defect-on-hold" });
    expect((await defectDetails(db, defectId))?.hold).toMatchObject({ reason: "waiting-for-part" });
  });
});

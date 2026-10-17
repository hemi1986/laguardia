import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { anOpenDefectIn } from "@/test-support/defects";
import { claimDefectCommand, defectDetails, putDefectOnHoldCommand, resumeDefectCommand } from ".";

/** CMD-ResumeDefect (ST-029) through the command layer: a defect on hold can progress again. */
const db = testDatabase();
const recorded = fixedClock("2026-10-12T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

const dependencies = (actor: Actor, at: string) => ({ actor, db, clock: fixedClock(at), newId: randomUUID });

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("CMD-ResumeDefect", () => {
  it("ST-029: Claimant resumes a defect", async () => {
    const { defectId } = await anOpenDefectIn(db, {
      title: "Display flickers",
      suitableForHelpers: true,
      recordedBy: tom,
      at: recorded,
    });
    await executeCommand(claimDefectCommand, { defectId, version: 0 }, dependencies(anna, "2026-10-12T09:00:00Z"));
    await executeCommand(
      putDefectOnHoldCommand,
      { defectId, version: 1, reason: "waiting-for-part" },
      dependencies(anna, "2026-10-12T10:00:00Z"),
    );

    const resumed = await executeCommand(
      resumeDefectCommand,
      { defectId, version: 2 },
      dependencies(anna, "2026-10-14T10:00:00Z"),
    );

    expect(resumed).toEqual({ ok: true, result: { defectId } });
    expect(await defectDetails(db, defectId)).toMatchObject({
      state: "open",
      hold: undefined,
      claim: { claimedBy: anna.teamMemberId },
    });
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)).toMatchObject({
      type: "EVT-DefectResumed",
      actor: anna,
    });
  });
});

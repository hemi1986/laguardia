import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { anOpenDefectIn } from "@/test-support/defects";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { changeDefectDetailsCommand, defectDetails, openDefectTitles } from ".";

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

function change(
  defectId: string,
  version: number,
  details: { title: string; suitableForHelpers: boolean },
  actor: Actor,
) {
  return executeCommand(
    changeDefectDetailsCommand,
    { defectId, version, ...details },
    { actor, db, clock: fixedClock("2026-10-18T10:00:00Z"), newId: randomUUID },
  );
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
});

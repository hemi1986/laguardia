import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { anOpenDefectIn } from "@/test-support/defects";
import {
  claimDefectCommand,
  defectDetails,
  openDefects,
  openDefectTitles,
  reopenDefectCommand,
  resolveDefectCommand,
} from ".";

/** CMD-ReopenDefect (ST-030) through the command layer: a resolved defect is open again when its fault comes back. */
const db = testDatabase();
const recorded = fixedClock("2026-10-12T08:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

const dependencies = (actor: Actor, at: string) => ({ actor, db, clock: fixedClock(at), newId: randomUUID });

/** A defect resolved by Tom – claimed first, so a reopened defect can be seen to be unclaimed. */
async function aResolvedDefect(title: string, closingNote = "Coil replaced") {
  const defect = await anOpenDefectIn(db, { title, suitableForHelpers: true, recordedBy: tom, at: recorded });
  const claimed = await executeCommand(
    claimDefectCommand,
    { defectId: defect.defectId, version: 0 },
    dependencies(tom, "2026-10-12T09:00:00Z"),
  );
  if (!claimed.ok) throw new Error(claimed.error);
  const resolved = await executeCommand(
    resolveDefectCommand,
    { defectId: defect.defectId, version: 1, closingNote },
    dependencies(tom, "2026-10-12T10:00:00Z"),
  );
  if (!resolved.ok) throw new Error(resolved.error);
  return defect;
}

function reopen(defectId: string, version: number, reason: string, actor: Actor, at = "2026-10-13T10:00:00Z") {
  return executeCommand(reopenDefectCommand, { defectId, version, reason }, dependencies(actor, at));
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("CMD-ReopenDefect", () => {
  it("ST-030: Team member reopens a resolved defect", async () => {
    const { machineId, defectId } = await aResolvedDefect("Left flipper weak");
    expect(await openDefectTitles(db, machineId)).toEqual([]);

    const reopened = await reopen(defectId, 2, "  Flipper weak again after an hour of play ", anna);

    expect(reopened).toEqual({ ok: true, result: { defectId } });
    expect(await defectDetails(db, defectId)).toMatchObject({
      state: "open",
      hold: undefined,
      claim: undefined,
      // The earlier resolution stays as it was – the reopening is an entry of its own (data model).
      resolutions: [{ closingNote: "Coil replaced", resolvedBy: tom.teamMemberId }],
      reopenings: [
        {
          reason: "Flipper weak again after an hour of play",
          reopenedBy: anna.teamMemberId,
          reopenedAt: new Date("2026-10-13T10:00:00Z"),
        },
      ],
    });
    // Back in the open defects list and on the visitor machine page.
    expect(await openDefects(db, { machineId })).toMatchObject([{ title: "Left flipper weak" }]);
    expect(await openDefectTitles(db, machineId)).toEqual(["Left flipper weak"]);
    // The reason is typed text – the journal names only who reopened it (its actor).
    const entry = (await journalOf(db, { aggregateId: defectId })).at(-1);
    expect(entry).toMatchObject({ type: "EVT-DefectReopened", actor: anna, machineId });
    expect(entry?.data).toEqual({});
  });
});

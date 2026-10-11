import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { claimDefectCommand, openDefects, reportProblemAndTriageCommand } from ".";
import { resolveDefectForTest, storedDefect } from "./problem-report-stand-ins.test-support";

/** CMD-ClaimDefect (ST-025) through the command layer: a team member claims a defect or takes it over. */
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

function claim(defectId: string, version: number, actor: Actor, at: string) {
  return executeCommand(
    claimDefectCommand,
    { defectId, version },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
}

/** Who the open defects list names as the defect's claimant (RM-OpenDefects). */
async function claimantOf(machineId: string) {
  const [entry] = await openDefects(db, { machineId });
  return entry.claimedBy;
}

describe("CMD-ClaimDefect", () => {
  it("ST-025: Taking over a claimed defect", async () => {
    const { machineId, defectId } = await anOpenDefect("Rubber cracked", true);
    expect(await claim(defectId, 0, tom, "2026-10-12T09:00:00Z")).toEqual({
      ok: true,
      result: { defectId, takenOverFrom: undefined },
    });
    expect(await claimantOf(machineId)).toBe(tom.teamMemberId);

    const takenOver = await claim(defectId, 1, anna, "2026-10-12T10:00:00Z");

    expect(takenOver).toEqual({ ok: true, result: { defectId, takenOverFrom: tom.teamMemberId } });
    // Anna is its claimant – Tom no longer is: a defect has at most one.
    expect(await claimantOf(machineId)).toBe(anna.teamMemberId);
    expect((await storedDefect(db, defectId))?.claim).toEqual({
      claimedBy: anna.teamMemberId,
      claimedAt: new Date("2026-10-12T10:00:00Z"),
    });
    expect(
      (await journalOf(db, { aggregateId: defectId })).map((entry) => [entry.type, entry.actor, entry.data]),
    ).toEqual([
      ["EVT-DefectClaimed", tom, { claimedBy: tom.teamMemberId }],
      ["EVT-DefectClaimed", anna, { claimedBy: anna.teamMemberId }],
    ]);
  });
});

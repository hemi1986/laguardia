import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { defectDetails, logWorkCommand, openDefects, reportProblemAndTriageCommand } from ".";

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
});

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  dismissProblemReportCommand,
  logWorkCommand,
  recordDefectCommand,
  repairHistory,
  reportProblemCommand,
  resolveDefectCommand,
  resolveProblemOnTheSpotCommand,
} from ".";
import { anOpenDefectIn } from "@/test-support/defects";

/**
 * The repair history of a machine (RM-MachineRecord, ST-033): its defects with their work log entries and resolutions,
 * and its problem reports resolved on the spot – the newest first. Each test has a machine of its own.
 */
const db = testDatabase();
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const at = (instant: string) => fixedClock(instant);

/** A visitor's problem report for the machine, untriaged – at version 0. */
async function aProblemReport(machineId: string, description: string, instant: string) {
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock: at(instant), newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  return reported.result.problemReportId;
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
});

describe("RM-MachineRecord – the repair history", () => {
  it("ST-033: Problems resolved on the spot are part of the repair history", async () => {
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await aProblemReport(machineId, "Ball stuck behind the flipper", "2026-10-01T09:00:00Z");
    const resolved = await executeCommand(
      resolveProblemOnTheSpotCommand,
      { problemReportId, version: 0, note: "Ball freed" },
      { actor: tom, db, clock: at("2026-10-01T09:30:00Z"), newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);

    expect(await repairHistory(db, machineId)).toEqual([
      {
        kind: "resolved-on-the-spot",
        id: problemReportId,
        description: "Ball stuck behind the flipper",
        reportedAt: new Date("2026-10-01T09:00:00Z"),
        note: "Ball freed",
        resolvedBy: tom.teamMemberId,
        resolvedAt: new Date("2026-10-01T09:30:00Z"),
      },
    ]);
  });

  it("ST-033: Dismissed problem reports are not part of the repair history", async () => {
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await aProblemReport(machineId, "It is too hard", "2026-10-01T09:00:00Z");
    const dismissed = await executeCommand(
      dismissProblemReportCommand,
      { problemReportId, version: 0, reason: "not-a-fault", reasonText: "" },
      { actor: tom, db, clock: at("2026-10-01T09:30:00Z"), newId: randomUUID },
    );
    if (!dismissed.ok) throw new Error(dismissed.error);
    // Nor is a problem report that waits for triage.
    await aProblemReport(machineId, "Display flickers", "2026-10-02T09:00:00Z");

    expect(await repairHistory(db, machineId)).toEqual([]);
  });

  it("shows each defect with its work log – the oldest entry first – and its resolutions, the newest defect first", async () => {
    const coinDoor = await anOpenDefectIn(db, {
      title: "Coin door jammed",
      recordedBy: tom,
      at: at("2026-09-01T08:00:00Z"),
    });
    const { machineId } = coinDoor;
    for (const [version, whatWasDone, partsUsed, instant] of [
      [0, "Lock oiled", undefined, "2026-09-02T10:00:00Z"],
      [1, "Lock taken apart", "Lock 27mm", "2026-09-03T10:00:00Z"],
    ] as const) {
      const logged = await executeCommand(
        logWorkCommand,
        { defectId: coinDoor.defectId, version, whatWasDone, partsUsed: partsUsed ?? "" },
        { actor: tom, db, clock: at(instant), newId: randomUUID },
      );
      if (!logged.ok) throw new Error(logged.error);
    }
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId: coinDoor.defectId, version: 2, closingNote: "Lock replaced" },
      { actor: tom, db, clock: at("2026-09-04T10:00:00Z"), newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);
    // A defect still open is part of it too – recorded later, so it comes first.
    const flipper = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper weak" },
      { actor: { kind: "visitor" }, db, clock: at("2026-10-01T08:00:00Z"), newId: randomUUID },
    );
    if (!flipper.ok) throw new Error(flipper.error);
    const recorded = await executeCommand(
      recordDefectCommand,
      {
        problemReportId: flipper.result.problemReportId,
        version: 0,
        title: "Left flipper weak",
        priority: "high",
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      { actor: tom, db, clock: at("2026-10-01T09:00:00Z"), newId: randomUUID },
    );
    if (!recorded.ok) throw new Error(recorded.error);

    const history = await repairHistory(db, machineId);

    expect(history).toMatchObject([
      { kind: "defect", title: "Left flipper weak", state: "open", workLog: [], resolutions: [] },
      {
        kind: "defect",
        id: coinDoor.defectId,
        title: "Coin door jammed",
        state: "resolved",
        recordedAt: new Date("2026-09-01T08:00:00Z"),
        workLog: [
          { whatWasDone: "Lock oiled", partsUsed: undefined, loggedBy: tom.teamMemberId },
          { whatWasDone: "Lock taken apart", partsUsed: "Lock 27mm", loggedBy: tom.teamMemberId },
        ],
        resolutions: [
          { closingNote: "Lock replaced", resolvedBy: tom.teamMemberId, resolvedAt: new Date("2026-09-04T10:00:00Z") },
        ],
      },
    ]);
  });
});

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { whileHoldingRow } from "@/test-support/held-row";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { problemReportsOfMachine, reportProblemCommand, retireMachineCommand, untriagedProblemReportCount } from ".";
import { storedProblemReport } from "./command-probes.test-support";

/**
 * A visitor's problem report at the same moment as the retirement (ST-039, ADR 0010) – two real transactions, not a
 * sequence. A third transaction holds the machine's row, which stops whichever of the two comes first just before it
 * commits: the retirement when it saves the machine, the problem report when its foreign key checks the machine. The
 * other one starts then and must wait for the retirement lock instead of slipping in between.
 */
const db = testDatabase();
const clock = fixedClock("2026-03-01T11:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

const holdingTheMachine = (machineId: string) => sql`SELECT id FROM machine WHERE id = ${machineId} FOR UPDATE`;
const retire = (machineId: string) =>
  executeCommand(
    retireMachineCommand,
    { machineId, version: 0, reason: "Sold to a collector" },
    { actor: tom, db, clock, newId: randomUUID },
  );
const report = (machineId: string) =>
  executeCommand(
    reportProblemCommand,
    { machineId, description: "Ball stuck in the scoop" },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );

describe("a problem report while the machine is retired", () => {
  it("ST-039: Problem report at the moment of retirement", async () => {
    await anExistingTeamMember(db, tom, "Tom");

    // The retirement first: the problem report waits for it, then finds the machine retired and is rejected.
    const lg013 = await aRegisteredMachine(db);
    const first = await whileHoldingRow(db, holdingTheMachine(lg013), async (untilWaiting) => {
      const retiring = retire(lg013);
      await untilWaiting(1); // the retirement holds the lock and waits to save the machine
      const reporting = report(lg013);
      await untilWaiting(2); // the problem report waits for the retirement lock
      return { retiring, reporting };
    });
    expect(await first.retiring).toMatchObject({ ok: true });
    expect(await first.reporting).toEqual({ ok: false, error: "machine-retired" });
    expect(await problemReportsOfMachine(db, lg013)).toEqual([]);

    // The problem report first: the retirement waits for it, then dismisses it.
    const lg014 = await aRegisteredMachine(db);
    const second = await whileHoldingRow(db, holdingTheMachine(lg014), async (untilWaiting) => {
      const reporting = report(lg014);
      await untilWaiting(1); // the problem report has checked the machine and waits for its foreign key
      const retiring = retire(lg014);
      await untilWaiting(2); // the retirement waits for the problem report's share of the lock
      return { retiring, reporting };
    });
    expect(await second.reporting).toMatchObject({ ok: true });
    expect(await second.retiring).toMatchObject({ ok: true });
    const [dismissed] = await problemReportsOfMachine(db, lg014);
    expect((await storedProblemReport(db, dismissed.id))?.triage).toMatchObject({
      outcome: "dismissed",
      dismissal: { reason: "machine-retired" },
    });

    for (const machineId of [lg013, lg014]) expect(await untriagedProblemReportCount(db, machineId)).toBe(0);
  });
});

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { dismissProblemReportCommand, reportProblemCommand, triageList, type DismissProblemReportInput } from ".";
import { storedProblemReport } from "./problem-report-stand-ins.test-support";

/** CMD-DismissProblemReport (ST-020) through the command layer – a triage outcome for technicians only. */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function anUntriagedProblemReport(description = "Way too hard to score") {
  await anExistingTeamMember(db, eva, "Eva");
  const machineId = await aRegisteredMachine(db);
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  return { machineId, problemReportId: reported.result.problemReportId };
}

function dismiss(
  problemReportId: string,
  dismissal: Pick<DismissProblemReportInput, "reason" | "reasonText">,
  actor: Actor = eva,
) {
  return executeCommand(
    dismissProblemReportCommand,
    { problemReportId, version: 0, ...dismissal },
    { actor, db, clock, newId: randomUUID },
  );
}

async function untriagedIds() {
  return (await triageList(db, clock)).map((listed) => listed.id);
}

describe("CMD-DismissProblemReport", () => {
  it("ST-020: Technician dismisses a problem report", async () => {
    const { machineId, problemReportId } = await anUntriagedProblemReport();

    const dismissed = await dismiss(problemReportId, { reason: "not-a-fault", reasonText: "" });

    expect(dismissed).toEqual({ ok: true, result: { problemReportId, removedPhoto: undefined } });
    expect(await storedProblemReport(db, problemReportId)).toMatchObject({
      description: "Way too hard to score",
      triage: {
        outcome: "dismissed",
        triagedBy: eva.teamMemberId,
        triagedAt: new Date("2026-10-09T10:00:00Z"),
        dismissal: { reason: "not-a-fault" },
      },
    });
    const [entry] = (await journalOf(db, { aggregateId: problemReportId })).slice(-1);
    expect(entry).toMatchObject({
      type: "EVT-ProblemReportDismissed",
      machineId,
      actor: { kind: "team-member", teamMemberId: eva.teamMemberId, role: "technician" },
      data: { reason: "not-a-fault" },
    });
    expect(await untriagedIds()).not.toContain(problemReportId);
  });

  it("ST-020: A reason is required", async () => {
    const { problemReportId } = await anUntriagedProblemReport();

    expect(await dismiss(problemReportId, { reason: undefined, reasonText: "" })).toEqual({
      ok: false,
      error: "dismissal-reason-required",
    });
    expect((await storedProblemReport(db, problemReportId))?.triage).toBeUndefined();
    expect(await untriagedIds()).toContain(problemReportId);
  });

  it('ST-020: Reason "other" needs a free text', async () => {
    const { problemReportId } = await anUntriagedProblemReport();

    expect(await dismiss(problemReportId, { reason: "other", reasonText: "  " })).toEqual({
      ok: false,
      error: "dismissal-reason-text-required",
    });
    expect((await storedProblemReport(db, problemReportId))?.triage).toBeUndefined();
  });

  it('ST-020: Dismissing with the reason "other"', async () => {
    const { problemReportId } = await anUntriagedProblemReport();

    const dismissed = await dismiss(problemReportId, {
      reason: "other",
      reasonText: " Machine was switched off on purpose for an event ",
    });

    expect(dismissed.ok).toBe(true);
    expect((await storedProblemReport(db, problemReportId))?.triage?.dismissal).toEqual({
      reason: "other",
      text: "Machine was switched off on purpose for an event",
    });
    // The free text is typed by a person: it lives in the problem report, never in the journal (ST-003).
    const [entry] = (await journalOf(db, { aggregateId: problemReportId })).slice(-1);
    expect(entry.data).toEqual({ reason: "other" });
  });

  it('refuses "machine retired" by hand like a missing reason, and accepts the three reasons a person may choose', async () => {
    const { problemReportId } = await anUntriagedProblemReport();

    // Set only by POL-RetirementDismissesProblemReports (ST-039) – by hand it is no reason at all.
    expect(await dismiss(problemReportId, { reason: "machine-retired", reasonText: "" })).toEqual({
      ok: false,
      error: "dismissal-reason-required",
    });
    expect((await storedProblemReport(db, problemReportId))?.triage).toBeUndefined();
    for (const reason of ["not-a-fault", "spam", "other"] as const) {
      const other = await anUntriagedProblemReport();
      expect((await dismiss(other.problemReportId, { reason, reasonText: "For an event" })).ok).toBe(true);
    }
  });

  it("is refused for helpers and visitors", async () => {
    const { problemReportId } = await anUntriagedProblemReport();
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, anna, "Anna");

    for (const actor of [anna, { kind: "visitor" } as const]) {
      expect(await dismiss(problemReportId, { reason: "not-a-fault", reasonText: "" }, actor)).toEqual({
        ok: false,
        error: "not-authorized",
      });
    }
  });
});

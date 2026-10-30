import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { anOpenDefectIn } from "@/test-support/defects";
import { changeMachineStatusCommand, machineRecord, statusHistoryOfMachine } from "@/modules/collection";
import { retireMachineCommand } from "./retirement-policies";
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

function reopen(
  defectId: string,
  version: number,
  reason: string,
  actor: Actor,
  status: { machineStatus?: "limited" | "out-of-order"; machineVersion?: number } = {},
) {
  return executeCommand(
    reopenDefectCommand,
    { defectId, version, reason, ...status },
    dependencies(actor, "2026-10-13T10:00:00Z"),
  );
}

/** The museum number the machine was registered with – its journal starts with EVT-MachineRegistered. */
async function museumNumberOf(machineId: string) {
  const [registered] = await journalOf(db, { machineId });
  return registered.data.museumNumber as string;
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

  it("ST-030: Technician changes the machine status while reopening", async () => {
    const { machineId, defectId } = await aResolvedDefect("Left flipper weak");

    const reopened = await reopen(defectId, 2, "Weak again", tom, { machineStatus: "limited", machineVersion: 0 });

    expect(reopened).toEqual({ ok: true, result: { defectId } });
    expect((await defectDetails(db, defectId))?.state).toBe("open");
    const record = await machineRecord(db, await museumNumberOf(machineId));
    expect(record?.machineStatus).toBe("limited");
    expect((await statusHistoryOfMachine(db, record!.id))[0]).toMatchObject({
      previousStatus: "playable",
      newStatus: "limited",
      reason: "Left flipper weak",
      changedBy: tom.teamMemberId,
    });
  });

  it("ST-030: A reason is required", async () => {
    const { defectId } = await aResolvedDefect("Coin door sticks");

    expect(await reopen(defectId, 2, "   ", anna)).toEqual({ ok: false, error: "reopen-reason-required" });
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
  });

  it("ST-030: Open defects cannot be reopened", async () => {
    const { defectId } = await anOpenDefectIn(db, { title: "Display flickers", recordedBy: tom, at: recorded });

    expect(await reopen(defectId, 0, "Again", anna)).toEqual({ ok: false, error: "defect-not-resolved" });
  });

  it("ST-030: No reopening on retired machines", async () => {
    const { machineId, defectId } = await aResolvedDefect("Coin mech jammed");
    const retired = await executeCommand(
      retireMachineCommand,
      { machineId, version: 0, reason: "Sold" },
      dependencies(tom, "2026-10-12T12:00:00Z"),
    );
    if (!retired.ok) throw new Error(retired.error);

    expect(await reopen(defectId, 2, "Jammed again", tom)).toEqual({ ok: false, error: "machine-retired" });
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
    // No page offers it (G11): the defect page asks the same rule.
    expect((await defectDetails(db, defectId, tom))?.actions?.reopen).toBe("machine-retired");
  });

  it("refuses a machine status chosen by a helper – only technicians change it while reopening", async () => {
    const { machineId, defectId } = await aResolvedDefect("Rubber cracked");

    expect(
      await reopen(defectId, 2, "Cracked again", anna, { machineStatus: "out-of-order", machineVersion: 0 }),
    ).toEqual({ ok: false, error: "not-authorized" });
    expect((await machineRecord(db, await museumNumberOf(machineId)))?.machineStatus).toBe("playable");
  });

  it("refuses a machine status that is not stricter – an Out of order machine keeps its status while reopening", async () => {
    const { machineId, defectId } = await aResolvedDefect("Coil burnt");
    const outOfOrder = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 0, machineStatus: "out-of-order", reason: "Power supply" },
      dependencies(tom, "2026-10-12T11:00:00Z"),
    );
    if (!outOfOrder.ok) throw new Error(outOfOrder.error);

    expect(await reopen(defectId, 2, "Burnt again", tom, { machineStatus: "limited", machineVersion: 1 })).toEqual({
      ok: false,
      error: "machine-status-not-stricter",
    });
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
    expect((await machineRecord(db, await museumNumberOf(machineId)))?.machineStatus).toBe("out-of-order");
  });
});

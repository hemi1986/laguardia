import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { defectDetails, prioritizeDefectCommand, resolveDefectCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { testDatabase } from "@/test-support/database";
import { anOpenDefectIn } from "@/test-support/defects";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadDefectForPrioritizing } from "./prioritize-defect-data";
import { prioritizeDefectFields, prioritizeDefectInput } from "./prioritize-defect-input";

/**
 * The form „Priorität ändern“ (ST-027): which priorities its page offers – only one CMD-PrioritizeDefect would accept
 * (G11) –, and its fields and input function run through the Server Action runner as the signed-in team member.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-14T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const asTom = { id: tom.teamMemberId, role: tom.role };

const anOpenDefect = async () =>
  (await anOpenDefectIn(db, { title: "Display flickers", recordedBy: tom, at: clock })).defectId;

function formFor(defectId: string, actor: Actor) {
  const prioritized: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(
    prioritizeDefectCommand,
    {
      fields: prioritizeDefectFields,
      input: (fields) => prioritizeDefectInput(fields, defectId),
      onSuccess: async (result) => void prioritized.push(result.defectId),
    },
  );
  return { action, prioritized };
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("the form „Priorität ändern“", () => {
  it("offers the priorities other than the one the defect has", async () => {
    const defectId = await anOpenDefect();

    expect(await loadDefectForPrioritizing(db, defectId, asTom)).toMatchObject({
      title: "Display flickers",
      version: 0,
      priority: "normal",
      priorities: ["high", "low"],
      whyNot: undefined,
    });
  });

  it("says why to someone who may not prioritize, and that a defect does not exist", async () => {
    const defectId = await anOpenDefect();
    expect(await loadDefectForPrioritizing(db, defectId, { id: anna.teamMemberId, role: "helper" })).toMatchObject({
      whyNot: "not-authorized",
    });

    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Cable replaced." },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);
    expect(await loadDefectForPrioritizing(db, defectId, asTom)).toMatchObject({ whyNot: "defect-not-open" });
    expect(await loadDefectForPrioritizing(db, randomUUID(), asTom)).toBeUndefined();
  });

  it("changes the priority to the chosen one, as the signed-in technician", async () => {
    const defectId = await anOpenDefect();
    const form = formFor(defectId, tom);

    expect(await form.action(null, post({ version: "0", priority: "high" }))).toBeNull();

    expect(form.prioritized).toEqual([defectId]);
    expect((await defectDetails(db, defectId))?.priority).toBe("high");
  });

  it("keeps the choice when it is rejected, and never fills in a priority", async () => {
    const defectId = await anOpenDefect();

    const nothing = await formFor(defectId, tom).action(null, post({ version: "0" }));
    expect(nothing).toEqual({ error: "priority-required", values: { version: "0", priority: "" } });
    expect(commandErrorText(teamMessages, nothing!.error)).toBe("Bitte eine Priorität auswählen.");
    // An unknown priority is no priority chosen.
    expect((await formFor(defectId, tom).action(null, post({ version: "0", priority: "urgent" })))?.error).toBe(
      "priority-required",
    );
    expect(await formFor(defectId, tom).action(null, post({ version: "0", priority: "normal" }))).toEqual({
      error: "priority-unchanged",
      values: { version: "0", priority: "normal" },
    });

    // A forged field for the acting person is not read: Anna stays the one who sent it.
    const byHelper = await formFor(defectId, anna).action(
      null,
      post({ version: "0", priority: "high", actor: tom.teamMemberId, role: "technician" }),
    );
    expect(byHelper?.error).toBe("not-authorized");
    expect((await defectDetails(db, defectId))?.priority).toBe("normal");
  });
});

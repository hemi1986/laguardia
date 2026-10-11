import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defectDetails, reportProblemAndTriageCommand, resolveDefectCommand } from "@/modules/repair";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { resolveDefectFields, resolveDefectInput } from "./resolve-defect-input";

/**
 * The form „Defekt beheben“ (ST-028): its fields and input function run through the Server Action runner as the
 * signed-in team member – what its Server Action does in a request. A rejection keeps the closing note (G8).
 */
const db = testDatabase();
const clock = fixedClock("2026-10-13T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

function post(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  return form;
}

/** An open defect that is not suitable for helpers, recorded by Tom. */
async function anOpenDefect() {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId: await aRegisteredMachine(db),
      description: "Display flickers – first seen",
      triage: {
        outcome: "defect-recorded",
        title: "Display flickers",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

/** The form's action for one defect, as the given team member. */
function formFor(defectId: string, actor: Actor) {
  const resolved: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(resolveDefectCommand, {
    fields: resolveDefectFields,
    input: (fields) => resolveDefectInput(fields, defectId),
    onSuccess: async (result) => void resolved.push(result.defectId),
  });
  return { action, resolved };
}

describe("the form „Defekt beheben“", () => {
  it("keeps what was typed when it is rejected, and says why in the catalogue's words", async () => {
    const defectId = await anOpenDefect();

    const withoutNote = await formFor(defectId, tom).action(null, post({ version: "0", closingNote: "  " }));
    expect(withoutNote).toEqual({ error: "closing-note-required", values: { version: "0", closingNote: "  " } });
    expect(commandErrorText(teamMessages, withoutNote!.error)).toBe(
      "Bitte kurz beschreiben, wie der Defekt behoben wurde.",
    );

    const byHelper = await formFor(defectId, anna).action(
      null,
      post({ version: "0", closingNote: "Cable plugged in" }),
    );
    expect(byHelper).toEqual({
      error: "not-suitable-for-helpers",
      values: { version: "0", closingNote: "Cable plugged in" },
    });
    expect((await defectDetails(db, defectId))?.state).toBe("open");
  });

  it("resolves as the signed-in team member, whatever else the form posts", async () => {
    const defectId = await anOpenDefect();
    const { action, resolved } = formFor(defectId, tom);

    const state = await action(
      null,
      post({
        version: "0",
        closingNote: "Display cable replaced",
        resolvedBy: anna.teamMemberId,
        defectId: randomUUID(),
      }),
    );

    expect(state).toBeNull();
    expect(resolved).toEqual([defectId]);
    expect((await defectDetails(db, defectId))?.resolution).toMatchObject({
      closingNote: "Display cable replaced",
      resolvedBy: tom.teamMemberId,
    });
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)).toMatchObject({
      type: "EVT-DefectResolved",
      actor: tom,
    });
  });

  it("answers a version nobody saw – or one someone changed meanwhile – with a conflict", async () => {
    const defectId = await anOpenDefect();

    for (const version of ["", "abc", "7"]) {
      const state = await formFor(defectId, tom).action(null, post({ version, closingNote: "Display cable replaced" }));
      expect(state?.error).toBe("version-conflict");
    }
    expect((await defectDetails(db, defectId))?.state).toBe("open");
  });
});

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { claimDefectCommand, defectDetails, logWorkCommand, resolveDefectCommand } from "@/modules/repair";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { logWorkFields, logWorkInput } from "./log-work-input";
import { post } from "@/test-support/forms";
import { anOpenDefectIn } from "@/test-support/defects";

/**
 * The form „Arbeitsschritt eintragen“ (ST-024): its fields and input function run through the Server Action runner as
 * the signed-in team member – what its Server Action does in a request. A rejection keeps both texts (G8).
 */
const db = testDatabase();
const clock = fixedClock("2026-10-13T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

/** An open defect that is not suitable for helpers, recorded by Tom. */
const anOpenDefect = async () =>
  (await anOpenDefectIn(db, { title: "Display flickers", recordedBy: tom, at: clock })).defectId;

/** The form's action for one defect, as the given team member. */
function formFor(defectId: string, actor: Actor) {
  const logged: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(logWorkCommand, {
    fields: logWorkFields,
    input: (fields) => logWorkInput(fields, defectId),
    onSuccess: async (result) => void logged.push(result.defectId),
  });
  return { action, logged };
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("the form „Arbeitsschritt eintragen“", () => {
  it("keeps what was typed when it is rejected, and says why in the catalogue's words", async () => {
    const defectId = await anOpenDefect();
    const values = { version: "0", whatWasDone: " ", partsUsed: "1x display cable" };

    const withoutWhat = await formFor(defectId, anna).action(null, post(values));

    expect(withoutWhat).toEqual({ error: "what-was-done-required", values });
    expect(commandErrorText(teamMessages, withoutWhat!.error)).toBe("Bitte kurz beschreiben, was gemacht wurde.");
    expect((await defectDetails(db, defectId))?.workLog).toEqual([]);

    // Resolved meanwhile: the texts stay, and the reason is the defect's state – not a conflict.
    const resolved = await executeCommand(
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Display cable replaced" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);
    const typed = { version: "0", whatWasDone: "Reseated the display connector", partsUsed: "" };
    expect(await formFor(defectId, anna).action(null, post(typed))).toEqual({
      error: "defect-not-open",
      values: typed,
    });
  });

  it("logs work as the signed-in team member, whatever else the form posts", async () => {
    const defectId = await anOpenDefect();
    const { action, logged } = formFor(defectId, anna);

    const state = await action(
      null,
      post({
        version: "0",
        whatWasDone: "Reseated the display connector",
        loggedBy: tom.teamMemberId,
        loggedAt: "2020-01-01T00:00:00Z",
        defectId: randomUUID(),
      }),
    );

    expect(state).toBeNull();
    expect(logged).toEqual([defectId]);
    // No field for the parts is no parts used.
    expect((await defectDetails(db, defectId))?.workLog).toMatchObject([
      {
        whatWasDone: "Reseated the display connector",
        partsUsed: undefined,
        loggedBy: anna.teamMemberId,
        loggedAt: new Date("2026-10-13T10:00:00Z"),
      },
    ]);
    expect((await journalOf(db, { aggregateId: defectId })).at(-1)).toMatchObject({
      type: "EVT-WorkLogged",
      actor: anna,
    });
  });

  it("answers a version nobody saw – or one someone changed meanwhile – with a conflict, and keeps the texts", async () => {
    const defectId = await anOpenDefect();
    const texts = { whatWasDone: "Reseated the display connector", partsUsed: "" };

    for (const version of ["", "abc", "7"]) {
      expect((await formFor(defectId, anna).action(null, post({ version, ...texts })))?.error).toBe("version-conflict");
    }
    // Meanwhile Tom claims it: the version the form showed is no longer the stored one.
    const claimed = await executeCommand(
      claimDefectCommand,
      { defectId, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!claimed.ok) throw new Error(claimed.error);
    expect(await formFor(defectId, anna).action(null, post({ version: "0", ...texts }))).toEqual({
      error: "version-conflict",
      values: { version: "0", ...texts },
    });
    expect((await defectDetails(db, defectId))?.workLog).toEqual([]);
    // Sent again with the version the re-rendered form shows, it is logged.
    expect(await formFor(defectId, anna).action(null, post({ version: "1", ...texts }))).toBeNull();
  });
});

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { claimDefectCommand, defectDetails } from "@/modules/repair";
import { deactivateAccount } from "@/modules/team";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { testDatabase } from "@/test-support/database";
import { anOpenDefectIn } from "@/test-support/defects";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadDefectForAssigning } from "./assign-defect-data";
import { assignDefectFields, assignDefectInput } from "./assign-defect-input";

/**
 * The form „Defekt zuweisen“ (ST-026): whom its page offers as a choice – only someone CMD-ClaimDefect would accept
 * (G11) –, and its fields and input function run through the Server Action runner as the signed-in team member.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-13T10:00:00Z");
const member = (role: "helper" | "technician") => ({ kind: "team-member", teamMemberId: randomUUID(), role }) as const;
const tom = member("technician");
const eva = member("technician");
const anna = member("helper");
const gone = member("technician");
const asTom = { id: tom.teamMemberId, role: tom.role };

const anOpenDefect = async (suitableForHelpers: boolean) =>
  (await anOpenDefectIn(db, { title: "Rubber cracked", suitableForHelpers, recordedBy: tom, at: clock })).defectId;

/** Which of this test's team members the page offers – the shared database holds other tests' team members too. */
async function offeredTo(defectId: string, viewer = asTom) {
  const details = await loadDefectForAssigning(db, defectId, viewer);
  const ours = new Map<string, unknown>([tom, eva, anna, gone].map((actor) => [actor.teamMemberId, actor]));
  return details?.teamMembers.flatMap(({ id, name, role }) => (ours.has(id) ? [`${name} (${role})`] : []));
}

function formFor(defectId: string, actor: Actor) {
  const assigned: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(claimDefectCommand, {
    fields: assignDefectFields,
    input: (fields) => assignDefectInput(fields, defectId),
    onSuccess: async (result) => void assigned.push(result.defectId),
  });
  return { action, assigned };
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, gone, "Gone");
  const deactivated = await deactivateAccount({ teamMemberId: gone.teamMemberId }, { db, actor: tom });
  if (!deactivated.ok) throw new Error(deactivated.error);
});

describe("the form „Defekt zuweisen“", () => {
  it("offers every active team member the defect can be assigned to – not oneself, not its claimant", async () => {
    const suitable = await anOpenDefect(true);
    expect(await offeredTo(suitable)).toEqual(["Anna (helper)", "Eva (technician)"]);

    // A helper is not offered a defect that is not suitable for helpers.
    expect(await offeredTo(await anOpenDefect(false))).toEqual(["Eva (technician)"]);

    // Its claimant already has it; the page names them.
    await executeCommand(
      claimDefectCommand,
      { defectId: suitable, version: 0 },
      { actor: eva, db, clock, newId: randomUUID },
    );
    expect(await offeredTo(suitable)).toEqual(["Anna (helper)"]);
    expect(await loadDefectForAssigning(db, suitable, asTom)).toMatchObject({
      title: "Rubber cracked",
      version: 1,
      claimant: { name: "Eva", you: false },
      whyNot: undefined,
    });
  });

  it("says why to someone who may not assign, and that a defect does not exist", async () => {
    const defectId = await anOpenDefect(true);

    expect(await loadDefectForAssigning(db, defectId, { id: anna.teamMemberId, role: "helper" })).toMatchObject({
      whyNot: "not-authorized",
      teamMembers: [],
    });
    expect(await loadDefectForAssigning(db, randomUUID(), asTom)).toBeUndefined();
  });

  it("assigns the defect to the chosen team member, as the signed-in technician", async () => {
    const defectId = await anOpenDefect(true);
    const form = formFor(defectId, tom);

    expect(await form.action(null, post({ version: "0", assignTo: anna.teamMemberId }))).toBeNull();

    expect(form.assigned).toEqual([defectId]);
    expect((await defectDetails(db, defectId))?.claim).toMatchObject({
      claimedBy: anna.teamMemberId,
      assignedBy: tom.teamMemberId,
    });
  });

  it("keeps the choice when it is rejected, and never claims the defect for who sent an empty choice", async () => {
    const defectId = await anOpenDefect(false);

    const nobody = await formFor(defectId, tom).action(null, post({ version: "0" }));
    expect(nobody).toEqual({ error: "team-member-required", values: { version: "0", assignTo: "" } });
    expect(commandErrorText(teamMessages, nobody!.error)).toBe("Bitte ein Teammitglied auswählen.");

    const toHelper = await formFor(defectId, tom).action(null, post({ version: "0", assignTo: anna.teamMemberId }));
    expect(toHelper).toEqual({
      error: "not-suitable-for-helpers",
      values: { version: "0", assignTo: anna.teamMemberId },
    });

    // A forged field for the acting person is not read: Anna stays the one who sent it.
    const byHelper = await formFor(defectId, anna).action(
      null,
      post({ version: "0", assignTo: eva.teamMemberId, actor: tom.teamMemberId, role: "technician" }),
    );
    expect(byHelper?.error).toBe("not-authorized");
    expect((await defectDetails(db, defectId))?.claim).toBeUndefined();
  });
});

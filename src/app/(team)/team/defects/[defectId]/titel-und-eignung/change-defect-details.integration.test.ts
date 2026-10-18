import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { changeDefectDetailsCommand, claimDefectCommand, defectDetails } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anOpenDefectIn } from "@/test-support/defects";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadDefectForChangingDetails } from "./change-defect-details-data";
import { ChangeDefectDetailsForm } from "./change-defect-details-form";
import { changeDefectDetailsFields, changeDefectDetailsInput } from "./change-defect-details-input";

/**
 * The form „Titel und Eignung ändern“ (ST-031): what its page shows – the title and the mark as they are, and that
 * removing the mark releases a helper's claim –, and its fields and input function run through the Server Action
 * runner as the signed-in team member.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-18T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const asTom = { id: tom.teamMemberId, role: tom.role };

const anOpenDefect = async (title: string, suitableForHelpers: boolean) =>
  (await anOpenDefectIn(db, { title, suitableForHelpers, recordedBy: tom, at: clock })).defectId;

async function claimedBy(defectId: string, actor: Actor) {
  const claimed = await executeCommand(
    claimDefectCommand,
    { defectId, version: 0 },
    { actor, db, clock, newId: randomUUID },
  );
  if (!claimed.ok) throw new Error(claimed.error);
}

/** The form page's data and its form as the technician sees it. */
async function formFor(defectId: string) {
  const details = await loadDefectForChangingDetails(db, defectId, asTom);
  if (!details) throw new Error("no such defect");
  const html = renderToStaticMarkup(
    createElement(ChangeDefectDetailsForm, {
      action: async () => null,
      version: details.version,
      title: details.title,
      suitableForHelpers: details.suitableForHelpers,
      releasesClaimOf: details.releasesClaimOf,
      whyNot: details.whyNot,
    }),
  );
  return { details, html };
}

function formAction(defectId: string, actor: Actor) {
  const changed: string[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID })(
    changeDefectDetailsCommand,
    {
      fields: changeDefectDetailsFields,
      input: (fields) => changeDefectDetailsInput(fields, defectId),
      onSuccess: async (result) => void changed.push(result.defectId),
    },
  );
  return { action, changed };
}

beforeAll(async () => {
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
});

describe("the form „Titel und Eignung ändern“", () => {
  it("ST-031: The form says that removing the mark releases the helper's claim", async () => {
    const defectId = await anOpenDefect("Rubber cracked", true);
    await claimedBy(defectId, anna);

    const { details, html } = await formFor(defectId);

    expect(details).toMatchObject({ title: "Rubber cracked", suitableForHelpers: true, releasesClaimOf: "Anna" });
    expect(html).toContain('value="Rubber cracked"');
    expect(html).toContain("Wird Besucher:innen am Gerät angezeigt – kurz und verständlich.");
    expect(html).toContain("Ohne diese Markierung wird die Übernahme von Anna aufgehoben.");
    expect(html).toContain("Defekt ändern");
  });

  it("says nothing about a claim a technician holds, or when there is none", async () => {
    const claimedByTom = await anOpenDefect("Rubber cracked", true);
    await claimedBy(claimedByTom, tom);
    const unclaimed = await anOpenDefect("Display flickers", false);

    for (const defectId of [claimedByTom, unclaimed]) {
      const { details, html } = await formFor(defectId);
      expect(details.releasesClaimOf).toBeUndefined();
      expect(html).not.toContain("Übernahme von");
    }
  });

  it("says why to someone who may not change the details, and that a defect does not exist", async () => {
    const defectId = await anOpenDefect("Display flickers", false);
    expect(await loadDefectForChangingDetails(db, defectId, { id: anna.teamMemberId, role: "helper" })).toMatchObject({
      whyNot: "not-authorized",
    });
    expect(await loadDefectForChangingDetails(db, randomUUID(), asTom)).toBeUndefined();
  });

  it("changes the title and the mark as posted, as the signed-in technician – an unticked box removes the mark", async () => {
    const defectId = await anOpenDefect("Rubber cracked", true);
    const form = formAction(defectId, tom);

    expect(await form.action(null, post({ version: "0", title: "Flipper rubber cracked" }))).toBeNull();

    expect(form.changed).toEqual([defectId]);
    expect(await defectDetails(db, defectId)).toMatchObject({
      title: "Flipper rubber cracked",
      suitableForHelpers: false,
    });
  });

  it("keeps what was typed when the change is rejected", async () => {
    const defectId = await anOpenDefect("Display flickers", false);
    const form = formAction(defectId, tom);

    expect(await form.action(null, post({ version: "0", title: "  ", suitableForHelpers: "on" }))).toEqual({
      error: "title-required",
      values: { version: "0", title: "  ", suitableForHelpers: "on" },
    });
    expect(form.changed).toEqual([]);
  });
});

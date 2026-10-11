import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { openDefectTitles, problemReportsOfMachine, reportProblemAndTriageCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { journalOf, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { photoFormRunner } from "@/app/_actions/form-runner";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  reportAndRecordDefectFields,
  reportAndRecordDefectInput,
  reportAndRecordDefectPhoto,
} from "./report-and-record-defect-input";

/**
 * The form „Problem melden und Defekt erfassen“ (ST-023): its fields and input function run through the Server Action
 * runner with a photo, as the signed-in team member – what its Server Action does in a request. The problem report, its
 * triage, the defect and the photo are stored together or not at all.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-11T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

function post(fields: Record<string, string>, photo?: File): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  if (photo) form.append("photo", photo);
  return form;
}

/** A photo as the browser prepared it. */
async function aPhoto(): Promise<File> {
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#3c78c8" } })
    .jpeg()
    .toBuffer();
  return new File([Uint8Array.from(jpeg)], "IMG_0042.jpg", { type: "image/jpeg" });
}

/** The form's action for one machine, with a storage of its own to look into. */
function formFor(machineId: string, actor: Actor = tom) {
  const storage = memoryStorage();
  const reported: { problemReportId: string; defectId?: string }[] = [];
  const action = photoFormRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID, storage })(
    reportProblemAndTriageCommand,
    {
      fields: reportAndRecordDefectFields,
      photo: reportAndRecordDefectPhoto,
      input: (fields, photo) => reportAndRecordDefectInput(fields, machineId, photo),
      onSuccess: async (result) => void reported.push(result),
    },
  );
  return { action, storage, reported };
}

/** Nothing of a rejected form is stored: no problem report, no defect, no journal entry, no photo. */
async function expectNothingStored(machineId: string, journalBefore: number, storage: ReturnType<typeof memoryStorage>) {
  expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
  expect(await openDefectTitles(db, machineId)).toEqual([]);
  expect(await journalOf(db, { machineId })).toHaveLength(journalBefore);
  expect(storage.names()).toEqual([]);
}

describe("the form for reporting a problem and recording a defect", () => {
  it("ST-023: Invalid triage part stores nothing", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const journalBefore = (await journalOf(db, { machineId })).length;
    const { action, storage, reported } = formFor(machineId);

    const state = await action(
      null,
      post({ description: "Left flipper coil stop broken", title: "", priority: "normal", machineStatus: "" }, await aPhoto()),
    );

    expect(state?.error).toBe("title-required");
    expect(reported).toEqual([]);
    await expectNothingStored(machineId, journalBefore, storage);
  });
});

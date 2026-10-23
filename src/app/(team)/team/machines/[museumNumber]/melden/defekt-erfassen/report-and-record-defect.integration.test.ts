import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  openDefectTitles,
  problemReportsOfMachine,
  reportProblemAndTriageCommand,
  reportProblemCommand,
} from "@/modules/repair";
import { retireMachineForTest } from "@/modules/collection/machines.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { commandErrorText, visitorMessages } from "@/platform/messages";
import { memoryStorage } from "@/platform/storage";
import { formRunner } from "@/app/_actions/form-runner";
import { teamReportProblemFields, teamReportProblemInput, teamReportProblemPhoto } from "../report-problem-input";
import { TriageChoice } from "../triage-choice";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { reportAndRecordDefectFields, reportAndRecordDefectInput } from "./report-and-record-defect-input";
import { rejectionText } from "../report-and-triage-rejection-text";
import { post } from "@/test-support/forms";

/**
 * The form „Problem melden und Defekt erfassen“ (ST-023): its fields and input function run through the Server Action
 * runner with a photo, as the signed-in team member – what its Server Action does in a request. The problem report, its
 * triage, the defect and the photo are stored together or not at all.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-11T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

/** A photo as the browser prepared it. */
async function aPhoto(): Promise<File> {
  const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#3c78c8" } })
    .jpeg()
    .toBuffer();
  return new File([Uint8Array.from(jpeg)], "IMG_0042.jpg", { type: "image/jpeg" });
}

/** The form's action for one machine, with a storage of its own to look into. */
function formFor(machineId: string, actor: Actor = tom, storage = memoryStorage()) {
  const reported: { problemReportId: string; defectId?: string }[] = [];
  const action = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID, storage })(
    reportProblemAndTriageCommand,
    {
      fields: reportAndRecordDefectFields,
      photo: teamReportProblemPhoto,
      input: (fields, photo) => reportAndRecordDefectInput(fields, machineId, photo),
      onSuccess: async (result) => void reported.push(result),
    },
  );
  return { action, storage, reported };
}

/** Nothing of a rejected form is stored: no problem report, no defect, no journal entry, no photo. */
async function expectNothingStored(
  machineId: string,
  journalBefore: number,
  storage: ReturnType<typeof memoryStorage>,
) {
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
      post(
        { description: "Left flipper coil stop broken", title: "", priority: "normal", machineStatus: "" },
        await aPhoto(),
      ),
    );

    expect(state?.error).toBe("title-required");
    expect(reported).toEqual([]);
    await expectNothingStored(machineId, journalBefore, storage);
  });

  it("ST-023: A rejected report says the photo must be chosen again", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const journalBefore = (await journalOf(db, { machineId })).length;
    const { action, storage } = formFor(machineId);
    const withPhoto = post({ description: "Left flipper coil stop broken", title: "" }, await aPhoto());
    const withoutPhoto = post({ description: "Left flipper coil stop broken", title: "" });

    const rejected = await action(null, withPhoto);
    const rejectedWithoutPhoto = await action(null, withoutPhoto);

    await expectNothingStored(machineId, journalBefore, storage);
    expect(rejectionText(rejected!, "LG-042")).toBe(
      "Bitte einen Titel angeben. Das Foto muss erneut ausgewählt werden.",
    );
    // Only a form that had a photo attached says so.
    expect(rejectionText(rejectedWithoutPhoto!, "LG-042")).toBe("Bitte einen Titel angeben.");
    // A photo that could not be stored was not rejected itself – "try again" needs it chosen again.
    const failing = { ...memoryStorage(), write: () => Promise.reject(new Error("Blob is down")) };
    const notStored = await formFor(machineId, tom, failing).action(null, withPhoto);
    expect(notStored?.error).toBe("not-stored");
    expect(rejectionText(notStored!, "LG-042")).toBe(
      "Das Foto konnte nicht gesendet werden. Bitte noch einmal versuchen oder ohne Foto melden. Das Foto muss erneut ausgewählt werden.",
    );
  });

  it("ST-023: A rejected photo gets no extra sentence about choosing it again", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const journalBefore = (await journalOf(db, { machineId })).length;
    const { action, storage } = formFor(machineId);
    const notAnImage = new File(["%PDF-1.7 not a photo"], "manual.pdf", { type: "application/pdf" });
    const form = post({ description: "Left flipper coil stop broken", title: "Left flipper sticks" }, notAnImage);

    const rejected = await action(null, form);

    await expectNothingStored(machineId, journalBefore, storage);
    expect(rejected?.error).toBe("not-an-image");
    // The text of ST-016, as on the team's report form without a defect – it already says what to do.
    expect(rejectionText(rejected!, "LG-042")).toBe("Das ist kein Foto. Bitte ein Foto wählen oder es weglassen.");
    expect(rejectionText(rejected!, "LG-042")).not.toContain("erneut ausgewählt");
    expect(rejected?.values.title).toBe("Left flipper sticks");
  });

  it("ST-023: Machine retired in the meantime stores nothing", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    // The form is open – its action is bound to the machine – when the machine is retired.
    const { action, storage } = formFor(machineId);
    const retired = await executeCommand(
      retireMachineForTest,
      { machineId, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!retired.ok) throw new Error("not retired");
    const journalBefore = (await journalOf(db, { machineId })).length;
    const form = post({ description: "Left flipper coil stop broken", title: "Left flipper sticks" });

    const rejected = await action(null, form);

    await expectNothingStored(machineId, journalBefore, storage);
    expect(rejected).toMatchObject({
      error: "machine-retired",
      values: { description: "Left flipper coil stop broken", title: "Left flipper sticks" },
    });
    expect(rejectionText(rejected!, "LG-042")).toBe("LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert.");
  });

  it("ST-023: Helpers cannot record a defect when reporting", async () => {
    // The page sends a helper to the plain report form (browser test); this is the helper who sends the form anyway.
    const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);
    const journalBefore = (await journalOf(db, { machineId })).length;
    const { action, storage, reported } = formFor(machineId, anna);

    const rejected = await action(
      null,
      post({ description: "Left flipper coil stop broken", title: "Left flipper sticks" }, await aPhoto()),
    );

    expect(rejected?.error).toBe("not-authorized");
    expect(reported).toEqual([]);
    await expectNothingStored(machineId, journalBefore, storage);
  });

  it("ST-023: A report form loaded before sends nothing for a technician", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const journalBefore = (await journalOf(db, { machineId })).length;
    const storage = memoryStorage();
    // ST-015's plain form, as a page loaded before the change still sends it – now as a technician.
    const plainForm = formRunner({ currentPerson: async () => tom, db, clock, newId: randomUUID, storage })(
      reportProblemCommand,
      {
        fields: teamReportProblemFields,
        photo: teamReportProblemPhoto,
        input: (fields, photo) => teamReportProblemInput(fields, machineId, photo),
        onSuccess: async () => {},
      },
    );

    const rejected = await plainForm(null, post({ description: "Left flipper coil stop broken" }));

    expect(rejected?.error).toBe("triage-required");
    await expectNothingStored(machineId, journalBefore, storage);
    // Where the action sends the technician with that rejection: the choice page, asking to choose.
    const choicePage = renderToStaticMarkup(
      createElement(TriageChoice, {
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness",
        triageRequired: true,
      }),
    );
    expect(choicePage).toContain("Bitte wählen, wie die Meldung gesichtet wird. Es wurde nichts gespeichert.");
    expect(choicePage).toMatch(
      /<a[^>]*href="\/team\/machines\/LG-042\/melden\/defekt-erfassen"[^>]*>Defekt erfassen<\/a>/,
    );
    expect(choicePage).not.toContain("Left flipper coil stop broken");
    expect(choicePage).not.toMatch(/<textarea|<form|<button/);
    // The visitors' report form, sent by a logged-in technician, ends the same way – its catalogues say where to report.
    expect(commandErrorText(visitorMessages("de"), "triage-required")).toContain("Es wurde nichts gespeichert.");
    expect(commandErrorText(visitorMessages("en"), "triage-required")).toContain("Nothing was saved.");
  });
});

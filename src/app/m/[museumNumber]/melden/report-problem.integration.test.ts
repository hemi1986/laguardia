import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { photoFormRunner } from "@/app/_actions/form-runner";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { commandErrorText, visitorMessages } from "@/platform/messages";
import { memoryStorage, type ContentStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { reportProblemFields, reportProblemInput, reportProblemPhoto } from "./report-problem-input";

/**
 * The visitor report form with a photo (ST-016): its fields, its photo and its input function through the Server
 * Action runner for forms with a photo, as a visitor, with the in-memory storage adapter – never Vercel Blob.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-04T10:00:00Z");

function reportForm(machineId: string, storage: ContentStorage) {
  return photoFormRunner({ currentPerson: async () => ({ kind: "visitor" }), db, clock, newId: randomUUID, storage })(
    reportProblemCommand,
    {
      fields: reportProblemFields,
      photo: reportProblemPhoto,
      input: (fields, photo) => reportProblemInput(fields, machineId, photo),
      onSuccess: async () => {},
    },
  );
}

function post(description: string, photo?: File): FormData {
  const form = new FormData();
  form.append("description", description);
  form.append("photo", photo ?? new File([], ""));
  return form;
}

const notAnImage = () => new File([new TextEncoder().encode("%PDF-1.7 not a photo")], "manual.jpg", { type: "image/jpeg" });

describe("the visitor report form with a photo", () => {
  it("ST-016: Non-image content is rejected", async () => {
    const machineId = await aRegisteredMachine(db);
    const storage = memoryStorage();

    const state = await reportForm(machineId, storage)(null, post("Ball stuck", notAnImage()));

    expect(state).toEqual({ error: "not-an-image", values: { description: "Ball stuck" } });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(storage.names()).toEqual([]);
    expect(commandErrorText(visitorMessages("de"), state!.error)).toBe(
      "Das ist kein Foto. Bitte wähle ein Foto aus oder lass es weg.",
    );
    expect(commandErrorText(visitorMessages("en"), state!.error)).toBe(
      "This is not a photo. Please choose a photo or leave it out.",
    );
  });

  it("ST-016: Failed photo keeps the description", async () => {
    const machineId = await aRegisteredMachine(db);
    const failing: ContentStorage = { ...memoryStorage(), write: () => Promise.reject(new Error("Blob is down")) };
    const photo = new File([await aJpeg()], "photo.jpg", { type: "image/jpeg" });

    const state = await reportForm(machineId, failing)(null, post("Right flipper dead", photo));

    expect(state).toEqual({ error: "not-stored", values: { description: "Right flipper dead" } });
    expect(commandErrorText(visitorMessages("de"), state!.error)).toBe(
      "Das Foto konnte nicht gesendet werden. Versuche es noch einmal oder sende die Meldung ohne Foto.",
    );
    // … and without a photo the problem report goes through.
    expect(await reportForm(machineId, failing)(state, post(state!.values.description))).toBeNull();
    expect((await problemReportsOfMachine(db, machineId)).map((r) => r.description)).toEqual(["Right flipper dead"]);
  });
});

async function aJpeg(): Promise<Uint8Array<ArrayBuffer>> {
  return Uint8Array.from(
    await sharp({ create: { width: 320, height: 240, channels: 3, background: "#c87828" } }).jpeg().toBuffer(),
  );
}

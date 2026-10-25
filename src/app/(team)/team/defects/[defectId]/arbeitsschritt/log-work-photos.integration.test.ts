import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { claimDefectCommand, defectDetails, logWorkCommand } from "@/modules/repair";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { memoryStorage, type ContentStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { anOpenDefectIn } from "@/test-support/defects";
import { anExistingTeamMember } from "@/test-support/team-members";
import { logWorkFields, logWorkInput, logWorkPhotos } from "./log-work-input";
import { logWorkRejectionText } from "./log-work-rejection-text";

/**
 * The form „Arbeitsschritt eintragen“ with photos (ST-032): its fields, photos and input function through the Server
 * Action runner as the signed-in team member, with the in-memory storage adapter – never Vercel Blob.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-25T10:00:00Z");
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

const anOpenDefect = async () =>
  (await anOpenDefectIn(db, { title: "Left flipper weak", recordedBy: tom, at: clock })).defectId;

function formFor(defectId: string, storage: ContentStorage) {
  return formRunner({ currentPerson: async () => anna, db, clock, newId: randomUUID, storage })(logWorkCommand, {
    fields: logWorkFields,
    photos: logWorkPhotos,
    input: (fields, photos) => logWorkInput(fields, defectId, photos),
    onSuccess: async () => {},
  });
}

/** A phone camera's photo: larger than stored, sideways with EXIF orientation 6, and with a GPS location. */
async function aPhonePhoto(): Promise<File> {
  const bytes = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExifMerge({ IFD0: { Make: "TestPhone" }, IFD3: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } })
    .toBuffer();
  return new File([new Uint8Array(bytes)], "photo.jpg", { type: "image/jpeg" });
}

function post(fields: Record<string, string>, photos: File[] = []): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  for (const photo of photos) form.append("photos", photo);
  return form;
}

beforeAll(async () => {
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, tom, "Tom");
});

describe("the form „Arbeitsschritt eintragen“ with photos", () => {
  it("ST-032: Team member logs work with photos", async () => {
    const defectId = await anOpenDefect();
    const storage = memoryStorage();

    const state = await formFor(defectId, storage)(
      null,
      post({ version: "0", whatWasDone: "Replaced coil stop", partsUsed: "" }, [
        await aPhonePhoto(),
        await aPhonePhoto(),
      ]),
    );

    expect(state).toBeNull();
    const [entry] = (await defectDetails(db, defectId))!.workLog;
    expect(entry.whatWasDone).toBe("Replaced coil stop");
    expect(entry.photos).toHaveLength(2);
    for (const photo of entry.photos) {
      const meta = await sharp(storage.read(photo)!.bytes).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2048);
      expect(meta.exif).toBeUndefined();
    }
  });

  it("ST-032: At most 5 photos", async () => {
    const defectId = await anOpenDefect();
    // Counts what is written: too many photos are refused before any of them is stored (code review ST-032).
    const memory = memoryStorage();
    let written = 0;
    const storage: ContentStorage = { ...memory, write: (...args) => (written++, memory.write(...args)) };
    const six = await Promise.all(Array.from({ length: 6 }, aPhonePhoto));

    const state = await formFor(defectId, storage)(
      null,
      post({ version: "0", whatWasDone: "Replaced coil stop", partsUsed: "" }, six),
    );

    expect(state?.error).toBe("too-many-photos");
    expect(logWorkRejectionText(state!)).toBe("Höchstens 5 Fotos pro Arbeitsschritt – bitte weniger Fotos auswählen.");
    expect((await defectDetails(db, defectId))!.workLog).toEqual([]);
    expect(written).toBe(0);
    expect(memory.names()).toEqual([]);
  });

  it("ST-032: The conflict text names the photos", async () => {
    const defectId = await anOpenDefect();
    const storage = memoryStorage();
    // Someone else claims „Left flipper weak“ while Anna is logging work on the version she saw.
    const claimed = await executeCommand(
      claimDefectCommand,
      { defectId, version: 0 },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!claimed.ok) throw new Error(claimed.error);

    const typed = { version: "0", whatWasDone: "Replaced coil stop", partsUsed: "" };
    const state = await formFor(defectId, storage)(null, post(typed, [await aPhonePhoto(), await aPhonePhoto()]));

    expect(state).toEqual({ error: "version-conflict", values: typed, photoAgain: true });
    expect(logWorkRejectionText(state!)).toBe(
      "Jemand hat den Defekt inzwischen geändert. Dein Text ist noch da, die Fotos müssen erneut ausgewählt werden – bitte noch einmal eintragen.",
    );
    expect(storage.names()).toEqual([]);
  });

  it("ST-032: Non-image content is rejected", async () => {
    const defectId = await anOpenDefect();
    const storage = memoryStorage();
    const notAnImage = new File([new TextEncoder().encode("%PDF-1.7 not a photo")], "manual.jpg", {
      type: "image/jpeg",
    });

    const state = await formFor(defectId, storage)(
      null,
      post({ version: "0", whatWasDone: "Replaced coil stop", partsUsed: "" }, [await aPhonePhoto(), notAnImage]),
    );

    expect(state?.error).toBe("not-an-image");
    expect(state?.photoAgain).toBeUndefined();
    expect((await defectDetails(db, defectId))!.workLog).toEqual([]);
    expect(storage.names()).toEqual([]);
  });

  it("asks to choose the photos again after a rejection that is not about them (G8a)", async () => {
    const defectId = await anOpenDefect();

    const state = await formFor(defectId, memoryStorage())(
      null,
      post({ version: "0", whatWasDone: " ", partsUsed: "" }, [await aPhonePhoto(), await aPhonePhoto()]),
    );

    expect(logWorkRejectionText(state!)).toBe(
      "Bitte kurz beschreiben, was gemacht wurde. Die Fotos müssen erneut ausgewählt werden.",
    );
  });
});

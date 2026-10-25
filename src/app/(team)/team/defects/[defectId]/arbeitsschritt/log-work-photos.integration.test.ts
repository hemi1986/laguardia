import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { defectDetails, logWorkCommand } from "@/modules/repair";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { memoryStorage, type ContentStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { anOpenDefectIn } from "@/test-support/defects";
import { anExistingTeamMember } from "@/test-support/team-members";
import { logWorkFields, logWorkInput, logWorkPhotos } from "./log-work-input";

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
});

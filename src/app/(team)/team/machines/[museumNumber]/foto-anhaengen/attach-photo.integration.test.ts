import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { attachFileCommand, machineRecord } from "@/modules/collection";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { post } from "@/test-support/forms";
import { machinesOfOneModel } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { attachPhotoForm } from "./attach-photo-form";

/**
 * The form that attaches a camera photo as a file (ST-054): the runner with its `photo` step (`formRunner`) and the
 * form's definition, against real PostgreSQL and the in-memory storage adapter – never Vercel Blob. The photo goes
 * through the photo module (ST-002, ST-016) and becomes a file of the file category Photo (ST-037).
 */
const db = testDatabase();
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

beforeAll(async () => {
  await anExistingTeamMember(db, anna);
});

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

/** The form on the page of the given machine, as Anna sends it. */
function photoForm(machineId: string, storage: MemoryStorage) {
  const action = formRunner({
    currentPerson: async () => anna,
    db,
    clock: fixedClock("2026-10-25T10:00:00Z"),
    newId: randomUUID,
    storage,
  })(
    attachFileCommand,
    attachPhotoForm(async () => {}),
  );
  return (fields: Record<string, string>, photo?: File) => action(null, post({ machineId, ...fields }, photo));
}

const filesOf = async (museumNumber: string) =>
  (await machineRecord(db, museumNumber))!.files.map(({ title, fileCategory }) => ({ title, fileCategory }));

describe("the form that attaches a camera photo", () => {
  it("ST-054: Team member attaches a camera photo to a machine", async () => {
    const [lg042, lg043] = await machinesOfOneModel(db, 2);
    const storage = memoryStorage();

    const state = await photoForm(lg042.machineId, storage)(
      { attachTo: "machine", title: "Backbox wiring 2026" },
      await aPhonePhoto(),
    );

    expect(state).toBeNull();
    expect(await filesOf(lg042.museumNumber)).toEqual([{ title: "Backbox wiring 2026", fileCategory: "photo" }]);
    expect(await filesOf(lg043.museumNumber)).toEqual([]);
    const [stored] = storage.names();
    const meta = await sharp(storage.read(stored)!.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe("jpeg");
  });
});

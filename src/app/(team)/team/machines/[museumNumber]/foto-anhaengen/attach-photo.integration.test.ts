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
import { teamMessages } from "@/platform/messages";
import { viewAddressOf } from "@/upload";
import { attachPhotoForm } from "./attach-photo-form";
import { attachPhotoRejectionText } from "./attach-photo-form-view";

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
    // A file's content is opened through its own address (ST-037) – the photo module's names must be accepted there.
    expect(await viewAddressOf(storage, fixedClock("2026-10-25T10:00:00Z"), stored)).toBeDefined();
  });

  it("ST-054: Photo of a machine model", async () => {
    const [lg042, lg043] = await machinesOfOneModel(db, 2);

    const state = await photoForm(lg042.machineId, memoryStorage())(
      { attachTo: "machine-model", title: "Original playfield" },
      await aPhonePhoto(),
    );

    expect(state).toBeNull();
    for (const { museumNumber } of [lg042, lg043])
      expect(await filesOf(museumNumber)).toEqual([{ title: "Original playfield", fileCategory: "photo" }]);
  });

  it("ST-054: Title is required", async () => {
    const [lg042] = await machinesOfOneModel(db, 1);
    const storage = memoryStorage();

    const state = await photoForm(lg042.machineId, storage)({ attachTo: "machine", title: " " }, await aPhonePhoto());

    expect(state).toMatchObject({ error: "title-required", photoAgain: true });
    expect(attachPhotoRejectionText(state!, teamMessages.attachPhoto.form)).toBe(
      "Bitte einen Titel angeben. Das Foto muss erneut ausgewählt werden.",
    );
    expect(await filesOf(lg042.museumNumber)).toEqual([]);
    expect(storage.names()).toEqual([]);
  });

  it("ST-054: Non-image content is rejected", async () => {
    const [lg042] = await machinesOfOneModel(db, 1);
    const storage = memoryStorage();
    const notAnImage = new File([new TextEncoder().encode("%PDF-1.7 not a photo")], "photo.jpg", {
      type: "image/jpeg",
    });

    const state = await photoForm(lg042.machineId, storage)({ attachTo: "machine", title: "Wiring" }, notAnImage);

    expect(state).toMatchObject({ error: "not-an-image" });
    expect(state).not.toHaveProperty("photoAgain");
    expect(await filesOf(lg042.museumNumber)).toEqual([]);
    expect(storage.names()).toEqual([]);
  });

  it("attaches nothing when the form is sent without a photo", async () => {
    const [lg042] = await machinesOfOneModel(db, 1);

    const state = await photoForm(lg042.machineId, memoryStorage())({ attachTo: "machine", title: "No photo" });

    expect(state).toMatchObject({ error: "file-required" });
    expect(attachPhotoRejectionText(state!, teamMessages.attachPhoto.form)).toBe(
      "Bitte ein Foto aufnehmen oder auswählen.",
    );
    expect(await filesOf(lg042.museumNumber)).toEqual([]);
  });
});

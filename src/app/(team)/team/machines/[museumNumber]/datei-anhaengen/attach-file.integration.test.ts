import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { makesAiWork } from "@/modules/ai-assistance/ai-work-events";
import { addFileCommand, machineRecord } from "@/modules/collection";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { teamMessages } from "@/platform/messages";
import { journalOf } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { post } from "@/test-support/forms";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { grantUploadAddress } from "@/upload";
import { attachFileForm } from "./attach-file-form";
import { rejectionWithFile } from "./attach-file-form-view";

/**
 * The form that attaches a file (ST-037): the runner with its `upload` step (`formRunner`) with the form's
 * definition, against real PostgreSQL and the in-memory storage adapter. The file was uploaded from the browser before
 * the form is sent (ST-085); the form posts its name.
 */
const db = testDatabase();
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const uploadedAt = "2026-10-18T10:00:00Z";
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let machineId: string;
let machineModelId: string;
let museumNumber: string;

beforeAll(async () => {
  for (const member of [anna, tom]) await anExistingTeamMember(db, member);
  machineId = await aRegisteredMachine(db);
  const [registered] = await journalOf(db, { aggregateId: machineId });
  museumNumber = registered.data.museumNumber as string;
  machineModelId = (await machineRecord(db, museumNumber))!.machineModelId;
});

/** A PDF a team member chose on the form (Anna unless said): uploaded, as the browser does it with the upload address. */
async function aChosenPdf(
  storage: MemoryStorage,
  { bytes = 3, maximumSize = undefined as number | undefined, by = anna as typeof anna | typeof tom } = {},
) {
  const at = { db, storage, clock: fixedClock(uploadedAt), newId: randomUUID };
  const issued = await grantUploadAddress(at, {
    issuedTo: by.teamMemberId,
    size: bytes,
    contentType: "application/pdf",
    maximumSize,
  });
  if (!issued.ok) throw new Error(issued.error);
  await storage.upload(issued.address, new Uint8Array(bytes), "application/pdf", new Date(uploadedAt));
  return issued.name;
}

function sendForm(storage: MemoryStorage, { when = "2026-10-18T10:05:00Z", by = anna as typeof anna | typeof tom } = {}) {
  const attached: string[] = [];
  const work = { started: 0 };
  const action = formRunner({
    currentPerson: async () => by,
    db,
    clock: fixedClock(when),
    newId: randomUUID,
    storage,
    afterCommit: (events) => {
      if (makesAiWork(events)) work.started += 1;
    },
  })(
    addFileCommand,
    attachFileForm(async ({ fileId }) => void attached.push(fileId)),
  );
  return {
    attached,
    work,
    send: (fields: Record<string, string>) => action(null, post({ machineId, machineModelId, fileName: "manual.pdf", ...fields })),
  };
}

const texts = { ...teamMessages.attachFile.form, fileCategories: teamMessages.fileCategories };
const complete = { attachTo: "machine", title: "MM Operations Manual", fileCategory: "manual" };
const titles = async () => (await machineRecord(db, museumNumber))!.files.map((file) => file.title);

describe("the form that attaches a file", () => {
  it("attaches the uploaded file and keeps its content", async () => {
    const storage = memoryStorage();
    const content = await aChosenPdf(storage);
    const form = sendForm(storage);

    expect(await form.send({ ...complete, title: "Attached through the form", content })).toBeNull();
    expect(form.attached).toHaveLength(1);
    expect(form.work.started).toBe(1);
    expect(await titles()).toContain("Attached through the form");
    expect(storage.read(content)).toBeDefined();
  });

  it("ST-037: File category is required", async () => {
    const storage = memoryStorage();
    const content = await aChosenPdf(storage);

    const state = await sendForm(storage).send({ ...complete, title: "Without a category", fileCategory: "", content });

    expect(state).toMatchObject({ error: "file-category-required", values: { content, fileName: "manual.pdf" } });
    expect(await titles()).not.toContain("Without a category");
    expect(storage.read(content)).toBeDefined();
  });

  it("ST-037: Title is required", async () => {
    const storage = memoryStorage();
    const content = await aChosenPdf(storage);
    const form = sendForm(storage);

    const state = await form.send({ ...complete, title: "  ", content });

    expect(state).toMatchObject({ error: "title-required", values: { content, fileName: "manual.pdf" } });
    expect(form.attached).toEqual([]);
    expect(rejectionWithFile(state!, texts)).toBe(
      "Bitte einen Titel angeben. Die gewählte Datei ist noch angehängt: manual.pdf",
    );
    // The chosen file is still attached: sent again with a title, the same uploaded content is attached.
    expect(await form.send({ ...complete, title: "Titled the second time", content })).toBeNull();
    expect(await titles()).toContain("Titled the second time");
  });

  it("ST-037: Machine or machine model must be chosen", async () => {
    const storage = memoryStorage();
    const content = await aChosenPdf(storage);

    const state = await sendForm(storage).send({ ...complete, title: "Belongs to nobody", attachTo: "", content });

    expect(state).toMatchObject({ error: "attach-to-required", values: { content } });
    expect(await titles()).not.toContain("Belongs to nobody");
  });

  it("ST-037: Attaching after the uploaded content is gone", async () => {
    const storage = memoryStorage();
    const content = await aChosenPdf(storage);

    const state = await sendForm(storage, { when: "2026-10-19T10:00:01Z" }).send({
      ...complete,
      title: "Too late",
      content,
    });

    expect(state).toEqual({
      error: "content-gone",
      values: {
        machineId,
        machineModelId,
        attachTo: "machine",
        title: "Too late",
        fileCategory: "manual",
        content: "",
        fileName: "",
      },
    });
    // The form says the file must be chosen again; its chooser starts empty, as no content is named any more.
    expect(rejectionWithFile(state!, texts)).toBe(
      "Die hochgeladene Datei ist nicht mehr da. Die Datei muss erneut ausgewählt werden.",
    );
    expect(await titles()).not.toContain("Too late");
  });

  it("refuses a file above its size limit when attaching, however the store came to hold it", async () => {
    const storage = memoryStorage();
    const content = await aChosenPdf(storage, { bytes: 4, maximumSize: 4 });
    await storage.write(content, new Uint8Array(5), "application/pdf");

    const state = await sendForm(storage).send({ ...complete, title: "Too large", content });

    expect(state).toMatchObject({ error: "too-large", values: { content: "", title: "Too large" } });
    expect(storage.read(content)).toBeUndefined();
  });

  it("refuses a machine that is no machine ID and deletes the content", async () => {
    const storage = memoryStorage();
    const content = await aChosenPdf(storage);

    const state = await sendForm(storage).send({ ...complete, title: "Forged", content, machineId: "not-an-id" });

    expect(state).toMatchObject({ error: "unknown-machine" });
    expect(storage.read(content)).toBeUndefined();
  });

  it("ST-113: Content uploaded by another team member is not added", async () => {
    const storage = memoryStorage();
    const annasUpload = await aChosenPdf(storage, { by: anna });
    const toms = sendForm(storage, { by: tom });

    const state = await toms.send({ ...complete, title: "Tom's try", content: annasUpload });

    expect(state).toMatchObject({
      error: "content-gone",
      values: { title: "Tom's try", fileCategory: "manual", content: "" },
    });
    expect(rejectionWithFile(state!, texts)).toBe(
      "Die hochgeladene Datei ist nicht mehr da. Die Datei muss erneut ausgewählt werden.",
    );
    expect(toms.attached).toEqual([]);
    expect(await titles()).not.toContain("Tom's try");
    // Anna's pending upload is untouched: she can still add it herself.
    expect(storage.read(annasUpload)).toBeDefined();
    expect(await sendForm(storage, { by: anna }).send({ ...complete, title: "Anna's own", content: annasUpload })).toBeNull();
  });

  it("says nothing about a file when none was chosen and the form's own fields are rejected", async () => {
    const state = await sendForm(memoryStorage()).send({ ...complete, title: "", content: "", fileName: "" });

    expect(rejectionWithFile(state!, texts)).toBe("Bitte einen Titel angeben.");
  });

  it("asks for a file when none was chosen", async () => {
    const state = await sendForm(memoryStorage()).send({ ...complete, title: "No file", content: "" });

    expect(state).toMatchObject({ error: "file-required" });
  });
});

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aiIndexOverview, fileIndexingWork } from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { makesAiWork } from "@/modules/ai-assistance/ai-work-events";
import { addFileCommand, filesForIndexing, machineModelOfMachineForAi, machineRecord } from "@/modules/collection";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { journalOf, lastCommandBy, type CommittedEvent } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { post } from "@/test-support/forms";
import { textOf } from "@/test-support/html";
import { machinesOfOneModel } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { grantUploadAddress } from "@/upload";
import { attachFileForm } from "./datei-anhaengen/attach-file-form";
import { attachPhotoForm } from "./foto-anhaengen/attach-photo-form";
import { loadFileDetails } from "../../dateien/[fileId]/details/file-details-data";
import { FileDetailsView } from "../../dateien/[fileId]/details/file-details-view";
import { loadFileOverview } from "../../dateien/file-overview-data";
import { loadMachineConfirmation } from "./machine-confirmation";

/**
 * Adding a file on the machine record (ST-037, ST-054, ST-113): both forms run CMD-AddFile through the Server Action
 * runner – the file added and attached in one step, its original file name stored, the AI work started by what the
 * command committed. Against real PostgreSQL and the in-memory storage adapter.
 */
// A database of its own: the test turns AI on, which is settings for the whole database.
const isolated = isolatedTestDatabase("add_file_on_machine_record");
let db: NodePgDatabase;
// One store for the forms and the AI work, as in the running application.
const storage = memoryStorage();
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const at = "2026-11-02T10:00:00Z";

const scenario = aiScenario({ db: () => db, storage: () => storage, clock: fixedClock(at), technician: tom });

beforeAll(async () => {
  db = await isolated.reset();
  for (const member of [anna, tom]) await anExistingTeamMember(db, member);
  await scenario.turnAiOn();
});
afterAll(() => isolated.close());

async function aPhonePhoto(name: string): Promise<File> {
  const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg()
    .toBuffer();
  return new File([new Uint8Array(bytes)], name, { type: "image/jpeg" });
}

/** The two forms of the machine record, each sending the chosen file named `name` for "nur LG-042". */
const forms = [
  {
    form: "„Datei anhängen“",
    send: async (
      machine: { machineId: string; machineModelId: string },
      name: string,
      committed: CommittedEvent[][],
    ) => {
      const issued = await grantUploadAddress(
        { db, storage, clock: fixedClock(at), newId: randomUUID },
        { issuedTo: anna.teamMemberId, size: 16, contentType: "text/plain" },
      );
      if (!issued.ok) throw new Error(issued.error);
      await storage.upload(issued.address, new TextEncoder().encode("Replace the coil"), "text/plain", new Date(at));
      const fileIds: string[] = [];
      const action = formRunner({
        currentPerson: async () => anna,
        db,
        clock: fixedClock(at),
        newId: randomUUID,
        storage,
        afterCommit: (events) => void committed.push([...events]),
      })(
        addFileCommand,
        attachFileForm(async ({ fileId }) => void fileIds.push(fileId)),
      );
      const state = await action(
        null,
        post({
          ...machine,
          attachTo: "machine",
          title: "MM Operations Manual",
          fileCategory: "manual",
          content: issued.name,
          fileName: name,
        }),
      );
      return { state, fileIds };
    },
  },
  {
    form: "„Foto aufnehmen“",
    send: async (
      machine: { machineId: string; machineModelId: string },
      name: string,
      committed: CommittedEvent[][],
    ) => {
      const fileIds: string[] = [];
      const action = formRunner({
        currentPerson: async () => anna,
        db,
        clock: fixedClock(at),
        newId: randomUUID,
        storage,
        afterCommit: (events) => void committed.push([...events]),
      })(
        addFileCommand,
        attachPhotoForm(async ({ fileId }) => void fileIds.push(fileId)),
      );
      const state = await action(
        null,
        post({ ...machine, attachTo: "machine", title: "MM Operations Manual" }, await aPhonePhoto(name)),
      );
      return { state, fileIds };
    },
  },
];

describe("adding a file on the machine record", () => {
  it("ST-113: Adding on the machine record adds and attaches in one step", async () => {
    for (const [index, { send }] of forms.entries()) {
      const name = ["medieval_manual-v2.pdf", "IMG_2041.jpg"][index];
      const [lg042, lg043] = await machinesOfOneModel(db, 2);
      const machineModelId = (await machineModelOfMachineForAi(db, lg042.machineId))!.id;
      const committed: CommittedEvent[][] = [];

      const { state, fileIds } = await send({ machineId: lg042.machineId, machineModelId }, name, committed);

      // The machine record of LG-042 shows the file, with the confirmation as before; LG-043 shows nothing.
      expect(state).toBeNull();
      const [fileId] = fileIds;
      const record = (await machineRecord(db, lg042.museumNumber))!;
      expect(record.files).toMatchObject([{ id: fileId, title: "MM Operations Manual", ofMachineModel: false }]);
      expect((await machineRecord(db, lg043.museumNumber))!.files).toEqual([]);
      expect(
        await loadMachineConfirmation(db, fixedClock(at), anna.teamMemberId, record, { attached: fileId }),
      ).toEqual({
        kind: "file-attached",
        title: "MM Operations Manual",
      });
      // The journal records the file added and attached to LG-042 in one step.
      expect((await lastCommandBy(db, { aggregateId: fileId }, anna.teamMemberId))?.map((entry) => entry.type)).toEqual(
        ["EVT-FileAdded", "EVT-FileAttached"],
      );
      expect(await journalOf(db, { aggregateId: fileId })).toMatchObject([
        { type: "EVT-FileAdded", machineId: null },
        { type: "EVT-FileAttached", machineId: lg042.machineId },
      ]);
      // The file has the original file name – stored, not shown yet.
      const stored = await db.execute(sql`SELECT original_file_name FROM file WHERE id = ${fileId}`);
      expect(stored.rows).toEqual([{ original_file_name: name }]);
      // What the command committed makes AI work, and the file is waiting for it – the run finds it on its own.
      expect(committed.flat().some((event) => event.type === "EVT-FileAdded")).toBe(true);
      expect(committed.some((events) => makesAiWork(events))).toBe(true);
      expect((await filesForIndexing(db)).map((file) => file.id)).toContain(fileId);
      // The run it starts indexes the file: in a database of its own, one more file is indexed and none waits.
      expect(await aiIndexOverview(db, scenario.ai())).toMatchObject({ indexed: index, waiting: 1 });
      await scenario.run({ kinds: [fileIndexingWork] });
      expect(await aiIndexOverview(db, scenario.ai())).toMatchObject({ indexed: index + 1, waiting: 0, failed: [] });
    }
  });

  it("ST-119: The machine record keeps adding through the same command", async () => {
    const [lg042] = await machinesOfOneModel(db, 1);
    const machineModelId = (await machineModelOfMachineForAi(db, lg042.machineId))!.id;
    const committed: CommittedEvent[][] = [];

    // When a team member adds "wiring.pdf" under „Datei anhängen“ on the machine record of "LG-042" …
    const { state, fileIds } = await forms[0].send(
      { machineId: lg042.machineId, machineModelId },
      "wiring.pdf",
      committed,
    );

    // … the team member is back on the machine record with its confirmation,
    expect(state).toBeNull();
    const [fileId] = fileIds;
    const record = (await machineRecord(db, lg042.museumNumber))!;
    expect(await loadMachineConfirmation(db, fixedClock(at), anna.teamMemberId, record, { attached: fileId })).toEqual({
      kind: "file-attached",
      title: "MM Operations Manual",
    });
    // „Details“ leads to its file details, which show the original file name and what it is attached to,
    const listed = record.files.find((file) => file.id === fileId)!;
    expect(listed.title).toBe("MM Operations Manual");
    const file = await loadFileDetails(db, fileId, {
      params: { from: `machine:${lg042.museumNumber}` },
      viewer: { id: anna.teamMemberId, role: anna.role },
      ai: scenario.ai(),
    });
    const opened = textOf(
      renderToStaticMarkup(
        createElement(FileDetailsView, { file: file!, retry: async () => null, detach: async () => null }),
      ),
    );
    expect(opened).toContain("Ursprünglicher Dateiname: wiring.pdf");
    expect(opened).toContain(`${lg042.museumNumber} · ${record.machineModel.title}`);
    // and „Dateien“ lists it.
    const overview = await loadFileOverview(db, { params: {}, viewer: { id: anna.teamMemberId }, ai: scenario.ai() });
    expect(overview.entries.map((entry) => entry.id)).toContain(fileId);
  });
});

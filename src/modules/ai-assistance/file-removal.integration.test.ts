import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executeCommand, journalOf } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { attachFileCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { aiSettingsForm, changeAiSettingsCommand, removeFileCommandWithAiIndex, type AiDependencies } from ".";
import { aiIndexEntryOf } from "./ai-index-entries";
import { withoutAiSettings } from "./ai-settings.test-support";
import { fileIndexingWork } from "./file-indexing-work";
import { runAiWork } from "./ai-work";
import { memoryAi, geminiEmbedding, geminiFlash } from "./ai-seam.test-support";
import { steppingClock } from "./ai-work-stand-in.test-support";
import { aPdfWithAScanInTheMiddle } from "./file-indexing.test-support";
import { aiWorkHold } from "./schema";

/**
 * ST-106: a removed file leaves the AI index in the same step (HS-29, POL-RemovedFileLeavesAiIndex), also while AI is
 * off; and an indexing that read the file before its removal never brings it back (the file's removal lock, ADR 0014).
 * The command is Collection's CMD-RemoveFile with AI assistance's policy added – what the file pages run.
 */
const isolated = isolatedTestDatabase("ai_file_removal");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-02T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";

let machineId: string;
let storage: MemoryStorage;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom);
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Eight Ball", manufacturer: "Bally", machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!model.ok) throw new Error(model.error);
  const machine = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: model.result.machineModelId,
      museumNumber: undefined,
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!machine.ok) throw new Error(machine.error);
  machineId = machine.result.machineId;
});
afterAll(() => isolated.close());

beforeEach(async () => {
  await db.delete(aiWorkHold);
  await db.execute("DELETE FROM ai_index_entry");
  await withoutAiSettings(db);
  clock.set("2026-11-02T10:00:00Z");
  storage = memoryStorage();
});

function anAi(settings: Parameters<typeof memoryAi>[0] = {}) {
  return memoryAi({ acceptedKeys: [KEY], ...settings });
}

async function saveAiSettings(): Promise<void> {
  const dependencies: AiDependencies = { ai: anAi(), encryptionKey: () => environmentKey };
  const { version } = await aiSettingsForm(db, dependencies);
  const saved = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
}

async function removeTheKey(): Promise<void> {
  const dependencies: AiDependencies = { ai: anAi(), encryptionKey: () => environmentKey };
  const { version } = await aiSettingsForm(db, dependencies);
  const removed = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: "", removeKey: true },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!removed.ok) throw new Error(removed.error);
}

async function attach(title: string, bytes: Uint8Array, contentType = "application/pdf"): Promise<string> {
  const name = `files/${randomUUID()}`;
  await storage.write(name, bytes, contentType);
  const attached = await executeCommand(
    attachFileCommand,
    {
      machineId,
      attachTo: "machine",
      title,
      fileCategory: "manual",
      content: { name, size: bytes.length, contentType },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return attached.result.fileId;
}

function run(ai = anAi()) {
  return runAiWork({
    db,
    clock,
    budgetSeconds: 250,
    ai: { ai, encryptionKey: () => environmentKey },
    storage,
    continueWork: async () => {},
    kinds: [fileIndexingWork],
  });
}

async function remove(fileId: string): Promise<void> {
  const removed = await executeCommand(removeFileCommandWithAiIndex, { fileId, version: 0 }, { actor: tom, db, clock });
  if (!removed.ok) throw new Error(removed.error);
}

const eventsOf = async (fileId: string) => (await journalOf(db, { aggregateId: fileId })).map((each) => each.type);

describe("a removed file and the AI index", () => {
  it("ST-106: A removed file leaves the AI index in the same step", async () => {
    await saveAiSettings();
    const fileId = await attach("Eight Ball Manual", await aPdfWithAScanInTheMiddle());
    await run();
    expect(await aiIndexEntryOf(db, fileId)).toMatchObject({ state: "indexed" });
    await removeTheKey(); // AI off – the removal still takes the entry

    await remove(fileId);

    expect(await aiIndexEntryOf(db, fileId)).toBeUndefined();
    expect(await eventsOf(fileId)).toContain("EVT-FileLeftAiIndex");
  });

  it("ST-106: A file removed while it is being indexed does not come back", async () => {
    await saveAiSettings();
    const fileId = await attach("Eight Ball Manual", await aPdfWithAScanInTheMiddle());
    // The technician removes the file after the indexing has read it and sent its first item.
    const ai = anAi({
      beforeEmbed: async (request) => {
        if (request === 1) await remove(fileId);
      },
    });

    await run(ai);

    expect(await aiIndexEntryOf(db, fileId)).toBeUndefined();
    const events = await eventsOf(fileId);
    expect(events).toContain("EVT-FileRemoved");
    expect(events).not.toContain("EVT-FileIndexedForAi");
    expect(events).not.toContain("EVT-FileIndexingFailed");
  });
});

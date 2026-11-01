import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executeCommand, journalOf } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { attachFileCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { aiSettingsForm, changeAiSettingsCommand, type AiDependencies } from ".";
import { aiIndexEntryOf } from "./ai-index-entries";
import { withoutAiSettings } from "./ai-settings.test-support";
import { fileIndexingWork } from "./file-indexing-work";
import { runAiWork } from "./ai-work";
import { memoryAi, geminiEmbedding, geminiFlash, type MemoryAiSettings } from "./ai-seam.test-support";
import { steppingClock } from "./ai-work-stand-in.test-support";
import {
  aPng,
  aJpeg,
  aWebp,
  aPdfOfText,
  aPdfWithAScanInTheMiddle,
  aDamagedPdf,
  nonWhitePixels,
} from "./file-indexing.test-support";
import { aiWorkHold } from "./schema";

/**
 * ST-106: indexing the files of machines and machine models for AI. Every scenario drives one run of the background
 * work directly – `runAiWork` with the real file kind, the injected clock, budget, in-memory AI and storage – against a
 * database of its own, as the story's Notes require. No test waits for a real background run.
 */
const isolated = isolatedTestDatabase("ai_file_indexing");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-02T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
const EMBEDDING = geminiEmbedding.id;

let machineId: string;
let machineModelId: string;
let storage: MemoryStorage;
let continueCalls: number;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom);
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Eight Ball", manufacturer: "Bally", machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!model.ok) throw new Error(model.error);
  machineModelId = model.result.machineModelId;
  const machine = await executeCommand(
    registerMachineCommand,
    {
      machineModelId,
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
  await db.execute("DELETE FROM file");
  await withoutAiSettings(db);
  clock.set("2026-11-02T10:00:00Z");
  storage = memoryStorage();
  continueCalls = 0;
});

/** The AI seam of a run – by default it accepts KEY and offers the Gemini models. */
function anAi(settings: MemoryAiSettings = {}) {
  return memoryAi({ acceptedKeys: [KEY], ...settings });
}

/** AI settings saved through CMD-ChangeAiSettings, the way a technician saves them. */
async function saveAiSettings({
  ai = anAi(),
  key = KEY as string | undefined,
  embeddingModel = EMBEDDING,
}: { ai?: ReturnType<typeof memoryAi>; key?: string; embeddingModel?: string } = {}): Promise<void> {
  const dependencies: AiDependencies = { ai, encryptionKey: () => environmentKey };
  const { version } = await aiSettingsForm(db, dependencies);
  const saved = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: key ?? "", chatModel: geminiFlash.id, embeddingModel },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
}

/** The key removed – AI is off from then on (data model, lifecycle *On → Off*). */
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

/** A file attached through CMD-AttachFile, with its content already in the store (ST-037, upload module). */
async function attach({
  title,
  contentType,
  bytes,
  to = "machine",
}: {
  title: string;
  contentType: string;
  bytes: Uint8Array;
  to?: "machine" | "machine-model";
}): Promise<string> {
  const name = `files/${randomUUID()}`;
  await storage.write(name, bytes, contentType);
  const attached = await executeCommand(
    attachFileCommand,
    {
      machineId,
      attachTo: to,
      title,
      fileCategory: "other",
      content: { name, size: bytes.length, contentType },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return attached.result.fileId;
}

/** One run of the background work, with this test's storage and AI. */
function run({ ai = anAi(), budgetSeconds = 250 }: { ai?: ReturnType<typeof memoryAi>; budgetSeconds?: number } = {}) {
  return runAiWork({
    db,
    clock,
    budgetSeconds,
    ai: { ai, encryptionKey: () => environmentKey },
    storage,
    continueWork: async () => {
      continueCalls += 1;
    },
    kinds: [fileIndexingWork],
  });
}

/** What the AI index holds of a file, failing loudly when it has no entry. */
async function entryOf(fileId: string) {
  const entry = await aiIndexEntryOf(db, fileId);
  if (!entry) throw new Error(`no AI index entry for ${fileId}`);
  return entry;
}

/** How many index items are really stored for a file – not how many its state mapping shows. */
async function itemCount(fileId: string): Promise<number> {
  const { rows } = await db.execute<{ count: number }>(
    sql`SELECT count(*)::int AS count FROM ai_index_item WHERE file_id = ${fileId}`,
  );
  return rows[0].count;
}

const eventsOf = async (fileId: string) => (await journalOf(db, { aggregateId: fileId })).map((each) => each.type);

describe("what is indexed", () => {
  it("ST-106: An attached PDF manual is indexed page by page", async () => {
    await saveAiSettings();
    const ai = anAi();
    const fileId = await attach({
      title: "Eight Ball Manual",
      contentType: "application/pdf",
      bytes: await aPdfWithAScanInTheMiddle(),
      to: "machine-model",
    });

    await run({ ai });

    const entry = await entryOf(fileId);
    expect(entry).toMatchObject({
      state: "indexed",
      embeddingModel: EMBEDDING,
      pagesIndexed: 3,
      imagesIndexed: 3,
      owner: { machineModelId },
    });
    expect(entry.items.filter((item) => item.kind === "passage").map((item) => item.page)).toEqual([1, 3]);
    expect(entry.items.filter((item) => item.kind === "page-image").map((item) => item.page)).toEqual([1, 2, 3]);
    expect(entry.items.filter((item) => item.kind === "image")).toEqual([]);
    // Every item carries where it came from, and every embedding was made with the one embedding model.
    for (const item of entry.items) expect(item.embedding).toHaveLength(1536);

    // Page 2 is a scan without text: its page image must not be blank (pdfjs' wasm/icc assets, ST-105).
    const pageImages = ai.embedInputs.filter((input) => input.kind === "image");
    expect(pageImages).toHaveLength(3);
    expect(await nonWhitePixels((pageImages[1] as { bytes: Uint8Array }).bytes)).toBeGreaterThan(1000);

    // The recorded cost is exactly what OpenRouter reported for its 3 page images and 2 text passages.
    expect(entry.cost).toBeCloseTo(ai.reportedCost, 10);
    expect(ai.embeddingRequests).toBe(5);
    const [indexed] = (await journalOf(db, { aggregateId: fileId })).filter(
      (each) => each.type === "EVT-FileIndexedForAi",
    );
    expect(indexed.data).toMatchObject({
      embeddingModel: EMBEDDING,
      pagesIndexed: 3,
      imagesIndexed: 3,
      cost: entry.cost,
    });
    // The passages and embeddings never reach the journal.
    expect(JSON.stringify(indexed.data)).not.toContain("flipper");
  });

  it("ST-106: Markdown, text files and images are indexed", async () => {
    await saveAiSettings();
    const markdown = await attach({
      title: "Coils.md",
      contentType: "text/markdown",
      bytes: new TextEncoder().encode("# Coils\n\nThe flipper coil is 50 V.\n\nCheck the diode first."),
    });
    const text = await attach({
      title: "Wiring.txt",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("Bumper switch on the left.\n\nThe right one is missing."),
    });
    const png = await attach({ title: "Backglass.png", contentType: "image/png", bytes: aPng(), to: "machine-model" });
    const jpeg = await attach({
      title: "Playfield.jpg",
      contentType: "image/jpeg",
      bytes: await aJpeg(),
      to: "machine-model",
    });
    const webp = await attach({
      title: "Coil.webp",
      contentType: "image/webp",
      bytes: await aWebp(),
      to: "machine-model",
    });

    await run();

    for (const [fileId, needle] of [
      [markdown, "flipper coil"],
      [text, "Bumper switch"],
    ] as const) {
      const entry = await entryOf(fileId);
      expect(entry).toMatchObject({ state: "indexed", pagesIndexed: 0, imagesIndexed: 0 });
      expect(entry.items.length).toBeGreaterThan(0);
      expect(entry.items.every((item) => item.kind === "passage" && item.page === undefined)).toBe(true);
      expect(entry.items.map((item) => item.text).join("\n")).toContain(needle);
    }
    for (const fileId of [png, jpeg, webp]) {
      const entry = await entryOf(fileId);
      expect(entry).toMatchObject({ state: "indexed", pagesIndexed: 0, imagesIndexed: 1 });
      expect(entry.items).toHaveLength(1);
      expect(entry.items[0]).toMatchObject({ kind: "image", embedding: expect.any(Array) });
      expect(entry.items[0].page).toBeUndefined();
      expect(entry.items[0].text).toBeUndefined();
    }
  });

  it("ST-106: A file of another format is not indexed", async () => {
    await saveAiSettings();
    const fileId = await attach({
      title: "Attract mode.mp4",
      contentType: "video/mp4",
      bytes: new Uint8Array([0, 1, 2, 3]),
    });

    await run();

    const entry = await entryOf(fileId);
    expect(entry).toMatchObject({ state: "failed", failureReason: "format not indexed", items: [] });
    expect(await eventsOf(fileId)).toContain("EVT-FileIndexingFailed");
    // Nothing of it is stored – the failed entry really holds no item, not only in the state mapping.
    expect(await itemCount(fileId)).toBe(0);
  });

  it("indexing a file again replaces its AI index entry as a whole", async () => {
    const otherEmbedding = { ...geminiEmbedding, id: "google/other-embedding", name: "Other Embedding" };
    const bothModels = anAi({ models: [geminiFlash, geminiEmbedding, otherEmbedding] });
    await saveAiSettings({ ai: bothModels });
    const fileId = await attach({
      title: "Coils.md",
      contentType: "text/markdown",
      bytes: new TextEncoder().encode("# Coils\n\nThe flipper coil is 50 V.\n\nCheck the diode first."),
    });
    await run();
    const before = await entryOf(fileId);

    // A second embedding model – POL-AiIndexFollowsTheSettings indexes every file again with it.
    await saveAiSettings({ ai: bothModels, embeddingModel: otherEmbedding.id });
    await run({ ai: bothModels });

    const after = await entryOf(fileId);
    expect(after).toMatchObject({ state: "indexed", embeddingModel: otherEmbedding.id });
    expect(after.at.getTime()).toBeGreaterThanOrEqual(before.at.getTime());
    // Replaced as a whole: the new items, none of the old ones, and no accumulation.
    expect(after.items).toHaveLength(before.items.length);
    expect(after.items.map((item) => item.id)).not.toEqual(before.items.map((item) => item.id));
    expect(await itemCount(fileId)).toBe(after.items.length);
  });

  it("ST-106: A file that cannot be read fails as not readable", async () => {
    await saveAiSettings();
    const damaged = await attach({ title: "Damaged manual", contentType: "application/pdf", bytes: aDamagedPdf() });
    const missing = await attach({
      title: "Missing manual",
      contentType: "application/pdf",
      bytes: new Uint8Array([1, 2, 3]),
    });
    const corruptImage = await attach({
      title: "Damaged photo",
      contentType: "image/png",
      bytes: new Uint8Array([9, 9, 9, 9]),
    });
    // The content is gone from the object store – a preview's database copied from production (ST-105).
    const missingContent = (await db.execute<{ content: string }>(sql`SELECT content FROM file WHERE id = ${missing}`))
      .rows[0].content;
    await storage.delete(missingContent);

    await run();

    for (const fileId of [damaged, missing, corruptImage]) {
      const entry = await entryOf(fileId);
      expect(entry).toMatchObject({ state: "failed", failureReason: "not readable", items: [] });
      expect(await itemCount(fileId)).toBe(0);
    }
  });

  it("ST-106: A failure at OpenRouter keeps nothing of the file", async () => {
    for (const [what, reason] of [
      ["stops answering", "OpenRouter not reachable"],
      ["refuses the request", "OpenRouter refused"],
    ] as const) {
      await db.execute("DELETE FROM ai_index_entry");
      await saveAiSettings();
      const ai = anAi({
        embedFailsAfter: { requests: 4, with: what === "stops answering" ? "unreachable" : "refused" },
      });
      const fileId = await attach({
        title: `Five pages ${what}`,
        contentType: "application/pdf",
        bytes: await aPdfOfText(["one", "two", "three", "four", "five"]),
      });

      await run({ ai });

      const entry = await entryOf(fileId);
      expect(entry).toMatchObject({
        state: "failed",
        failureReason: reason,
        items: [],
        pagesIndexed: 0,
        imagesIndexed: 0,
      });
      // None of its 5 pages is in the index.
      expect(entry.items).toEqual([]);
      // A later run does not index it again – a failed file is never retried by a run (HS-32).
      const requestsBefore = ai.embeddingRequests;
      await run({ ai });
      expect(ai.embeddingRequests).toBe(requestsBefore);
    }
  });
  it("a file whose indexing broke off is recorded failed as broken off, and no run takes it again", async () => {
    await saveAiSettings();
    const fileId = await attach({
      title: "Eight Ball Manual",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("The manual's only passage."),
    });
    // The run is cut off while it works on the file – a deployment or the time limit: its kind never returns.
    let started!: () => void;
    const hasStarted = new Promise<void>((resolve) => (started = resolve));
    const cutOff = anAi({
      beforeEmbed: () => {
        started();
        return new Promise<never>(() => {});
      },
    });
    void run({ ai: cutOff });
    await hasStarted;

    // Once its hold (twice the budget) has run out, the next run records it failed as *broken off* (POL-UnfinishedAiWorkFails).
    clock.advance(2 * 250 + 1);
    await run();

    expect(await entryOf(fileId)).toMatchObject({ state: "failed", failureReason: "broken off", items: [] });
    const requestsBefore = (await entryOf(fileId)).embeddingModel;
    expect(requestsBefore).toBe(EMBEDDING);
    // It is never taken again by itself.
    await run();
    expect(await entryOf(fileId)).toMatchObject({ state: "failed", failureReason: "broken off" });
  });
});

describe("when a file is indexed", () => {
  it("ST-106: Files attached while AI is off are indexed when it is turned on", async () => {
    const files = [];
    for (const title of ["Manual", "Schematic", "Notes"]) {
      files.push(
        await attach({
          title,
          contentType: "text/plain",
          bytes: new TextEncoder().encode(`${title} describes a part of the machine.`),
        }),
      );
    }

    // AI is off: a run finds nothing to do, and none of the 3 is indexed.
    await run({ ai: anAi({ beforeEmbed: () => clock.advance(100) }), budgetSeconds: 150 });
    for (const fileId of files) expect(await aiIndexEntryOf(db, fileId)).toBeUndefined();

    // Turning AI on starts the work (POL-AiIndexFollowsTheSettings) – with a budget for about two files per run.
    await saveAiSettings();
    await run({ ai: anAi({ beforeEmbed: () => clock.advance(100) }), budgetSeconds: 150 });

    expect(continueCalls).toBe(1);
    const afterFirstRun = await Promise.all(files.map((fileId) => aiIndexEntryOf(db, fileId)));
    expect(afterFirstRun.filter((entry) => entry?.state === "indexed")).toHaveLength(2);
    // The run that the first one started takes the file left over – each beyond the first started by the one before.
    await run({ ai: anAi(), budgetSeconds: 150 });
    for (const fileId of files) expect(await aiIndexEntryOf(db, fileId)).toMatchObject({ state: "indexed" });
  });

  it("ST-106: Turning AI off keeps the AI index and stops an indexing at once", async () => {
    await saveAiSettings();
    const manual = await attach({
      title: "Eight Ball Manual",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("The manual's only passage."),
    });
    await run();
    expect(await entryOf(manual)).toMatchObject({ state: "indexed" });

    const schematic = await attach({
      title: "Eight Ball Schematic",
      contentType: "application/pdf",
      bytes: await aPdfOfText(["one", "two", "three", "four", "five"]),
    });
    // Two of the five pages are sent, then a technician removes the key: no further page reaches OpenRouter.
    const ai = anAi({
      beforeEmbed: async (request) => {
        if (request === 4) await removeTheKey();
      },
    });

    await run({ ai });

    expect(ai.embeddingRequests).toBeLessThanOrEqual(4);
    // The manual is still there; the schematic has no entry, no failure, and counts as waiting.
    expect(await entryOf(manual)).toMatchObject({ state: "indexed" });
    expect(await aiIndexEntryOf(db, schematic)).toBeUndefined();
    expect(await eventsOf(schematic)).not.toContain("EVT-FileIndexingFailed");
    // A file attached afterwards is not indexed while AI is off.
    const later = await attach({
      title: "Later file",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("Attached while AI is off."),
    });
    await run({ ai: anAi() });
    expect(await aiIndexEntryOf(db, later)).toBeUndefined();
  });
});

describe("a run and the files it finds", () => {
  it("ST-106: A file is indexed once, even when two runs find it", async () => {
    await saveAiSettings();
    const fileId = await attach({
      title: "Eight Ball Manual",
      contentType: "text/plain",
      bytes: new TextEncoder().encode("The manual's only passage."),
    });

    await Promise.all([run(), run()]);

    const entry = await entryOf(fileId);
    expect(entry).toMatchObject({ state: "indexed" });
    const indexed = (await journalOf(db, { aggregateId: fileId })).filter(
      (each) => each.type === "EVT-FileIndexedForAi",
    );
    expect(indexed).toHaveLength(1);

    // A later run does not index it again while the embedding model is unchanged.
    await run();
    expect(
      (await journalOf(db, { aggregateId: fileId })).filter((each) => each.type === "EVT-FileIndexedForAi"),
    ).toHaveLength(1);
  });
});

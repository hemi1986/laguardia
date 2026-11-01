import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { attachFileCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { executeCommand, journalOf } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  aiIndexOverview,
  aiSettingsForm,
  changeAiSettingsCommand,
  requestAiAssessmentCommand,
  type AiDependencies,
  type ChangeAiSettingsInput,
} from ".";
import { aiAssessmentById } from "./ai-assessments";
import { aiAssessmentWork } from "./ai-assessment-work";
import { aiIndexEntryModels, anIndexedFile } from "./ai-index.test-support";
import { aiIndexEntryOf } from "./ai-index-entries";
import {
  geminiEmbedding,
  geminiFlash,
  memoryAi,
  type MemoryAiSettings,
  type MemoryModel,
} from "./ai-seam.test-support";
import { withoutAiSettings } from "./ai-settings.test-support";
import { runAiWork, type AiWorkKind } from "./ai-work";
import { steppingClock } from "./ai-work-stand-in.test-support";
import { fileIndexingWork } from "./file-indexing-work";

/**
 * ST-110 in AI assistance: what a change of the chat model or of the embedding model does to the AI assessments and
 * the AI index. The change runs through CMD-ChangeAiSettings, the background work through `runAiWork` with the real
 * kinds, the injected clock, budget, in-memory AI and storage (seam catalog, ST-112) – no test waits for a real run.
 */
const isolated = isolatedTestDatabase("ai_settings_change");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-04T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";

const claudeSonnet: MemoryModel = {
  ...geminiFlash,
  id: "anthropic/claude-sonnet-4.5",
  name: "Claude Sonnet 4.5",
  pricePerMillion: { input: 3, output: 15 },
};
const otherEmbedding: MemoryModel = {
  ...geminiEmbedding,
  id: "other/embedding",
  name: "Other Embedding",
  pricePerMillion: { input: 0.2 },
};

let machineId: string;
let storage: MemoryStorage;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
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
  await db.execute("DELETE FROM ai_work_hold");
  await db.execute("DELETE FROM ai_assessment");
  await db.execute("DELETE FROM ai_index_entry");
  await db.execute("DELETE FROM file");
  await withoutAiSettings(db);
  clock.set("2026-11-04T10:00:00Z");
  storage = memoryStorage();
  await change({ key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id });
});

/** OpenRouter in memory: it accepts KEY and offers both chat models and both embedding models. */
function anAi(settings: MemoryAiSettings = {}) {
  return memoryAi({
    acceptedKeys: [KEY],
    models: [geminiFlash, claudeSonnet, geminiEmbedding, otherEmbedding],
    ...settings,
  });
}

const dependencies = (ai = anAi()): AiDependencies => ({ ai, encryptionKey: () => environmentKey });

/** CMD-ChangeAiSettings as Tom saves it, at the version stored now. */
async function change(input: Omit<ChangeAiSettingsInput, "version" | "key"> & { key?: string }) {
  const { version } = await aiSettingsForm(db, dependencies());
  const changed = await executeCommand(
    changeAiSettingsCommand(dependencies()),
    { version, key: "", ...input },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!changed.ok) throw new Error(changed.error);
}

/** „Embedding-Modell wechseln“ on the warning – the change confirmed. */
const confirmOtherEmbedding = () => change({ embeddingModel: otherEmbedding.id, embeddingModelConfirmed: true });

async function attachText(title: string, text: string): Promise<string> {
  const name = `files/${randomUUID()}`;
  const bytes = new TextEncoder().encode(text);
  await storage.write(name, bytes, "text/plain");
  const attached = await executeCommand(
    attachFileCommand,
    {
      machineId,
      attachTo: "machine",
      title,
      fileCategory: "manual",
      content: { name, size: bytes.length, contentType: "text/plain" },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return attached.result.fileId;
}

function run(kinds: AiWorkKind[], ai = anAi()) {
  return runAiWork({
    db,
    clock,
    budgetSeconds: 250,
    ai: dependencies(ai),
    storage,
    continueWork: async () => undefined,
    kinds,
  });
}

async function anOpenDefect(): Promise<string> {
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: "Left flipper weak",
      triage: {
        outcome: "defect-recorded",
        title: "Left flipper weak",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

/** An AI assessment requested by Tom and written by one run of the background work. */
async function anAiAssessment(defectId: string, ai = anAi()) {
  const requested = await executeCommand(
    requestAiAssessmentCommand(dependencies()),
    { defectId, note: "", photos: [] },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!requested.ok) throw new Error(requested.error);
  await run([aiAssessmentWork], ai);
  const written = await aiAssessmentById(db, requested.result.aiAssessmentId);
  if (written?.state !== "written") throw new Error(`the AI assessment is ${written?.state}`);
  return written;
}

const overview = async () => {
  const shown = await aiIndexOverview(db, dependencies());
  if (!shown) throw new Error("AI is off");
  return shown;
};

describe("changing the models", () => {
  it("ST-110: A new chat model applies to the next AI assessments only", async () => {
    const manual = await attachText("Eight Ball Manual", "The flipper coil is in the cabinet.");
    await run([fileIndexingWork]);
    const indexedAt = (await aiIndexEntryOf(db, manual))?.at;
    const defectId = await anOpenDefect();
    const earlier = await anAiAssessment(defectId);
    expect(earlier.chatModel).toBe(geminiFlash.id);

    await change({ chatModel: claudeSonnet.id });

    const ai = anAi();
    const next = await anAiAssessment(defectId, ai);
    expect(next.chatModel).toBe(claudeSonnet.id);
    expect(ai.chatRequests.map((request) => request.model)).toEqual([claudeSonnet.id]);
    expect((await aiAssessmentById(db, earlier.id))?.chatModel).toBe(geminiFlash.id);
    // No file is indexed again: the entry is the one of before, and nothing waits.
    await run([fileIndexingWork], ai);
    expect((await aiIndexEntryOf(db, manual))?.at).toEqual(indexedAt);
    expect((await journalOf(db, { aggregateId: manual })).map((entry) => entry.type)).toEqual([
      "EVT-FileAttached",
      "EVT-FileIndexedForAi",
    ]);
    expect(await overview()).toMatchObject({ indexed: 1, waiting: 0 });
  });

  it("ST-110: A confirmed embedding model indexes every file again", async () => {
    const manual = await attachText("Eight Ball Manual", "The flipper coil is in the cabinet.");
    const schematic = await attachText("Eight Ball Schematic", "Coil wiring of the left flipper.");
    await run([fileIndexingWork]);
    expect(await aiIndexEntryModels(db)).toEqual({ [manual]: geminiEmbedding.id, [schematic]: geminiEmbedding.id });

    await confirmOtherEmbedding();

    expect(await overview()).toMatchObject({ indexed: 0, waiting: 2 });
    // Meanwhile the manual is indexed with the new model, the schematic not yet.
    await anIndexedFile(db, clock, manual, { embeddingModel: otherEmbedding.id, pages: 1, text: "Coil manual" });
    const meanwhile = await anAiAssessment(await anOpenDefect());
    expect(meanwhile.filesSearched).toEqual([manual]);
    expect(await overview()).toMatchObject({ indexed: 1, waiting: 1 });

    await run([fileIndexingWork]);

    expect(await aiIndexEntryModels(db)).toEqual({ [manual]: otherEmbedding.id, [schematic]: otherEmbedding.id });
    expect(await overview()).toMatchObject({ indexed: 2, waiting: 0 });
  });

  it("ST-110: An indexing with the earlier embedding model that ends after the change still counts as waiting", async () => {
    const wiring = await attachText("Wiring notes", "Wiring notes: the left flipper coil is wired to J4.");
    // While "Wiring notes" is being indexed with Gemini Embedding 2, the change is confirmed – and the run's budget
    // ends with it, so the run stores that indexing and stops.
    const indexing = anAi({
      beforeEmbed: async (request) => {
        if (request !== 1) return;
        await confirmOtherEmbedding();
        clock.advance(300);
      },
    });

    await run([fileIndexingWork], indexing);

    expect(await aiIndexEntryModels(db)).toEqual({ [wiring]: geminiEmbedding.id });
    expect(await overview()).toMatchObject({ indexed: 0, waiting: 1 });
    const ai = anAi();
    const meanwhile = await anAiAssessment(await anOpenDefect(), ai);
    expect(meanwhile.filesSearched).toEqual([]);
    expect(ai.chatRequests[0].text).not.toContain("J4");

    await run([fileIndexingWork]);

    expect(await aiIndexEntryModels(db)).toEqual({ [wiring]: otherEmbedding.id });
    expect(await overview()).toMatchObject({ indexed: 1, waiting: 0 });
  });

  it("rejects a change of the saved embedding model without the warning, and changes nothing", async () => {
    const { version } = await aiSettingsForm(db, dependencies());

    const changed = await executeCommand(
      changeAiSettingsCommand(dependencies()),
      { version, key: "", embeddingModel: otherEmbedding.id },
      { actor: tom, db, clock, newId: randomUUID },
    );

    expect(changed).toMatchObject({ ok: false, error: "embedding-model-change-unconfirmed" });
    expect((await aiSettingsForm(db, dependencies())).embeddingModel?.id).toBe(geminiEmbedding.id);
  });
});

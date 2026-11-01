import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { attachFileCommand, type FileCategory } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import type { MemoryStorage } from "@/platform/storage";
import { aiSettingsForm, type AiDependencies } from "./ai-settings";
import { changeAiSettingsCommand } from "./change-ai-settings-command";
import { requestAiAssessmentCommand } from "./request-ai-assessment-command";
import { runAiWork, type AiWorkKind } from "./ai-work";
import { aJpeg } from "./file-indexing.test-support";
import { geminiEmbedding, geminiFlash, memoryAi, type MemoryAiSettings } from "./ai-seam.test-support";

/** The OpenRouter key every AI scenario saves – `memoryAi` from `ai()` accepts it. */
export const SCENARIO_KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";

/** The in-memory OpenRouter of a scenario – it records what it was asked. */
export type ScenarioOpenRouter = ReturnType<typeof memoryAi>;

/** The in-memory AI seam with the environment's encryption key – what the pages, commands and runs are given. */
export type ScenarioAi = AiDependencies & { ai: ScenarioOpenRouter };

/**
 * The steps of an AI scenario as a technician takes them (architecture review 2026-11-01): AI turned on and the key
 * removed through CMD-ChangeAiSettings, a file attached through CMD-AttachFile with its content in the store, an AI
 * assessment requested, and one run of the background work driven directly (ADR 0015, the seam catalog's run seam).
 *
 * A test binds its database, store, clock and technician once; `db` and `storage` are read at each step, so a test
 * that resets them per test binds them once all the same. The environment's encryption key is one per scenario.
 */
export function aiScenario({
  db,
  storage,
  clock,
  technician,
}: {
  db: () => NodePgDatabase;
  storage: () => MemoryStorage;
  clock: Clock;
  technician: Actor;
}) {
  const environmentKey = randomBytes(32);
  const by = { actor: technician, clock, newId: randomUUID };

  /** The in-memory OpenRouter – by default it accepts SCENARIO_KEY and offers the Gemini models. */
  function openRouter(settings: MemoryAiSettings = {}): ScenarioOpenRouter {
    return memoryAi({ acceptedKeys: [SCENARIO_KEY], ...settings });
  }

  /** The AI dependencies with the environment's encryption key – around `openRouter(settings)` or a given one. */
  function ai(settings: MemoryAiSettings | ScenarioOpenRouter = {}): ScenarioAi {
    const seam = "checkKey" in settings ? settings : openRouter(settings);
    return { ai: seam, encryptionKey: () => environmentKey };
  }

  const dependenciesOf = (given: AiDependencies | ScenarioOpenRouter): AiDependencies =>
    "encryptionKey" in given ? given : ai(given);

  /**
   * AI settings saved through CMD-ChangeAiSettings, the way a technician saves them – by default the key and both
   * Gemini models, so AI is on. A change of the saved embedding model is confirmed on the warning (ST-110).
   */
  async function turnAiOn({
    with: given = ai(),
    key = SCENARIO_KEY,
    chatModel = geminiFlash.id,
    embeddingModel = geminiEmbedding.id,
  }: {
    with?: AiDependencies | ScenarioOpenRouter;
    key?: string;
    chatModel?: string;
    embeddingModel?: string;
  } = {}): Promise<void> {
    const dependencies = dependenciesOf(given);
    const { version } = await aiSettingsForm(db(), dependencies);
    const saved = await executeCommand(
      changeAiSettingsCommand(dependencies),
      { version, key, chatModel, embeddingModel, embeddingModelConfirmed: true },
      { ...by, db: db() },
    );
    if (!saved.ok) throw new Error(saved.error);
  }

  /** The key removed through CMD-ChangeAiSettings – AI is off from then on, the AI index is kept. */
  async function removeTheKey(): Promise<void> {
    const dependencies = ai();
    const { version } = await aiSettingsForm(db(), dependencies);
    const removed = await executeCommand(
      changeAiSettingsCommand(dependencies),
      { version, key: "", removeKey: true },
      { ...by, db: db() },
    );
    if (!removed.ok) throw new Error(removed.error);
  }

  /** A file attached through CMD-AttachFile to a machine or to its machine model, its content already in the store. */
  async function attachFile(
    machineId: string,
    {
      title,
      bytes,
      contentType,
      to = "machine",
      fileCategory = "manual",
    }: {
      title: string;
      bytes: Uint8Array;
      contentType: string;
      to?: "machine" | "machine-model";
      fileCategory?: FileCategory;
    },
  ): Promise<string> {
    const name = `files/${randomUUID()}`;
    await storage().write(name, bytes, contentType);
    const attached = await executeCommand(
      attachFileCommand,
      { machineId, attachTo: to, title, fileCategory, content: { name, size: bytes.length, contentType } },
      { ...by, db: db() },
    );
    if (!attached.ok) throw new Error(attached.error);
    return attached.result.fileId;
  }

  /** A photo for an AI assessment in the store, as the form uploads it – `padding` makes it that many bytes larger. */
  async function aPhoto({ padding = 0 }: { padding?: number } = {}): Promise<string> {
    const name = `ai-assessments/${randomUUID()}.jpg`;
    const jpeg = await aJpeg();
    const bytes = new Uint8Array(jpeg.length + padding);
    bytes.set(jpeg);
    await storage().write(name, bytes, "image/jpeg");
    return name;
  }

  /**
   * An AI assessment requested through CMD-RequestAiAssessment – by the technician at the scenario's clock unless `by`
   * and `at` say otherwise – its ID.
   */
  async function requestAiAssessment(
    defectId: string,
    {
      note = "",
      photos = [],
      by: actor = technician,
      at = clock,
    }: { note?: string; photos?: string[]; by?: Actor; at?: Clock } = {},
  ): Promise<string> {
    const asked = await executeCommand(
      requestAiAssessmentCommand(ai()),
      { defectId, note, photos },
      { ...by, actor, clock: at, db: db() },
    );
    if (!asked.ok) throw new Error(asked.error);
    return asked.result.aiAssessmentId;
  }

  /**
   * One run of the background work with the given kinds, the scenario's clock and store, and – by default – `ai()`; it
   * may be given an `openRouter(…)` or whole AI dependencies.
   */
  function run({
    kinds,
    with: given = ai(),
    budgetSeconds = 250,
    continueWork = async () => undefined,
  }: {
    kinds: readonly AiWorkKind[];
    with?: AiDependencies | ScenarioOpenRouter;
    budgetSeconds?: number;
    continueWork?: () => Promise<void>;
  }): Promise<void> {
    const ai = dependenciesOf(given);
    return runAiWork({ db: db(), clock, budgetSeconds, ai, storage: storage(), continueWork, kinds });
  }

  return { openRouter, ai, turnAiOn, removeTheKey, attachFile, aPhoto, requestAiAssessment, run };
}

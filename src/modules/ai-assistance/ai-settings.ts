import { aggregateStore, type Database } from "@/platform/command";
import type { AiSeam, ModelKind, OfferedModel } from "./ai-seam";
import {
  AI_SETTINGS_ID,
  changedModel,
  newKeyOf,
  type AiSettingsFacts,
  type AiSettingsState,
  type ChangeAiSettingsInput,
} from "./change-ai-settings";
import { decryptKey, encryptKey, environmentEncryptionKey } from "./key-encryption";
import { openRouter } from "./openrouter";
import { aiSettings as aiSettingsTable } from "./schema";

/**
 * What AI assistance needs from outside (ADR 0014): the AI seam and the environment's encryption key – injected like
 * the storage seam, so tests pass the in-memory AI and a key of their own.
 */
export type AiDependencies = { ai: AiSeam; encryptionKey: () => Buffer | undefined };

/** The real dependencies: OpenRouter over HTTP and `AI_SETTINGS_ENCRYPTION_KEY`. */
export function aiDependencies(): AiDependencies {
  return { ai: openRouter(), encryptionKey: environmentEncryptionKey };
}

/** How AGG-AiSettings is stored (ST-104): its one row, versioned (HS-16); the key only encrypted. */
export const aiSettingsStore = aggregateStore({
  type: "AGG-AiSettings",
  table: aiSettingsTable,
  toState: (row): AiSettingsState => ({
    id: row.id,
    key: row.encryptedKey && row.keyLastFour ? { encrypted: row.encryptedKey, lastFour: row.keyLastFour } : undefined,
    chatModel: row.chatModel ?? undefined,
    embeddingModel: row.embeddingModel ?? undefined,
  }),
  toRow: ({ id, key, chatModel, embeddingModel }: AiSettingsState) => ({
    id,
    encryptedKey: key?.encrypted ?? null,
    keyLastFour: key?.lastFour ?? null,
    chatModel: chatModel ?? null,
    embeddingModel: embeddingModel ?? null,
  }),
});

/** The saved key, decrypted – undefined when there is none or it cannot be decrypted (then it counts as none). */
function usableKey(state: AiSettingsState, encryptionKey: Buffer | undefined): string | undefined {
  return state.key && encryptionKey ? decryptKey(encryptionKey, state.key.encrypted) : undefined;
}

/** A part of the AI settings that is missing while AI is off. */
export type MissingPart = "key" | "chat-model" | "embedding-model";

/**
 * Whether AI is on, the one answer (architecture review 2026-11-01). On: the key, decrypted, and both models – what a
 * request needs, and nothing can be sent without having asked. Off: what is missing, in the order the form „KI“ names
 * it; a saved key that cannot be decrypted with this environment's key counts as none and says so (ADR 0014, ST-110).
 */
export type AiState =
  | { on: true; key: string; chatModel: string; embeddingModel: string }
  | { on: false; missing: MissingPart[]; keyUnreadable: boolean };

function aiStateOf(state: AiSettingsState, encryptionKey: Buffer | undefined): AiState {
  const key = usableKey(state, encryptionKey);
  const { chatModel, embeddingModel } = state;
  if (key && chatModel && embeddingModel) return { on: true, key, chatModel, embeddingModel };
  return {
    on: false,
    missing: [
      ...(key ? [] : (["key"] as const)),
      ...(chatModel ? [] : (["chat-model"] as const)),
      ...(embeddingModel ? [] : (["embedding-model"] as const)),
    ],
    keyUnreadable: !!state.key && !key,
  };
}

/**
 * Is AI on now? Read before every request, so turning AI off, a rotated key or a changed model takes effect at once.
 * Not the same as `aiOn` of CMD-ChangeAiSettings, which says what was saved and cannot know whether the key is readable.
 */
export async function aiState(db: Database, { encryptionKey }: Pick<AiDependencies, "encryptionKey">): Promise<AiState> {
  const { state } = await storedAiSettings(db);
  return aiStateOf(state, encryptionKey());
}

/** The saved models, also while AI is off – they stay when the key is removed. */
export async function savedAiModels(
  db: Database,
): Promise<{ chatModel: string | undefined; embeddingModel: string | undefined }> {
  const { state } = await storedAiSettings(db);
  return { chatModel: state.chatModel, embeddingModel: state.embeddingModel };
}

/**
 * What OpenRouter says about the parts the technician sent (CMD-ChangeAiSettings): the new key checked – and encrypted
 * when accepted –, a model that differs from the saved one looked up, and a new embedding model tried with one test
 * embedding, sent with the new key or the saved one. Nothing is asked about a part that was not sent.
 */
export async function aiSettingsFacts(
  { ai, encryptionKey }: AiDependencies,
  state: AiSettingsState,
  input: ChangeAiSettingsInput,
): Promise<AiSettingsFacts> {
  if (input.removeKey) return {};
  const newKey = newKeyOf(input);
  const facts: AiSettingsFacts = {};
  if (newKey) {
    const check = await ai.checkKey(newKey);
    if (check !== "accepted") return { key: { check } };
    const environmentKey = encryptionKey();
    // Without the environment's key nothing can be kept encrypted – a deployment error (docs/operations).
    if (!environmentKey)
      throw new Error("AI_SETTINGS_ENCRYPTION_KEY is not set – see docs/operations/ai-settings-encryption-key.md");
    facts.key = { check, encrypted: encryptKey(environmentKey, newKey) };
  }
  const chatModel = changedModel(state.chatModel, input.chatModel);
  if (chatModel) facts.chatModel = await ai.model("chat", chatModel);
  const embeddingModel = changedModel(state.embeddingModel, input.embeddingModel);
  if (embeddingModel) {
    const model = await ai.model("embedding", embeddingModel);
    const key = newKey ?? usableKey(state, encryptionKey());
    const test =
      typeof model === "object" && model.readsTextAndImages
        ? key
          ? await ai.testEmbedding(key, embeddingModel)
          : "no-key"
        : undefined;
    facts.embeddingModel = { model, test };
  }
  return facts;
}

/** A model of OpenRouter's list on the form „KI“ – one that does not fit is listed, marked, and cannot be chosen. */
export type ListedModel = OfferedModel & { fits: boolean };

/** RM-AiSettings (ST-104): what the form „KI“ shows. */
export type AiSettingsForm = {
  version: number;
  aiOn: boolean;
  /** What is missing for AI to be on, in the order the form names it. */
  missing: MissingPart[];
  /** The saved key's last four characters – never the key; none when it cannot be decrypted (ADR 0014). */
  keyLastFour: string | undefined;
  /** A key is saved but cannot be decrypted with this environment's key – it counts as none (ADR 0014, ST-110). */
  keyUnreadable: boolean;
  /** The saved models, with their names when OpenRouter's list has them. */
  chatModel: { id: string; name: string | undefined } | undefined;
  embeddingModel: { id: string; name: string | undefined } | undefined;
  /** OpenRouter's lists when the form is opened – "unavailable": the model IDs are typed by hand. */
  offered: { chat: ListedModel[]; embedding: ListedModel[] } | "unavailable";
};

async function storedAiSettings(db: Database): Promise<{ state: AiSettingsState; version: number }> {
  const stored = await aiSettingsStore.load(db, AI_SETTINGS_ID);
  // The migration inserts the one record; without it the database is not migrated.
  if (!stored) throw new Error("The AI settings are missing – is the database migrated?");
  return stored;
}

const byName = (a: OfferedModel, b: OfferedModel) => a.name.localeCompare(b.name, "de");

async function listed(ai: AiSeam, kind: ModelKind): Promise<ListedModel[] | "unavailable"> {
  const models = await ai.offeredModels(kind);
  if (models === "unavailable") return models;
  // Whether an embedding model returns 1536 numbers shows only on saving (user, 2026-11-01).
  return models.map((model) => ({ ...model, fits: model.readsTextAndImages })).sort(byName);
}

/** RM-AiSettings (ST-104): the AI settings as the form „KI“ shows them, with OpenRouter's models read now. */
export async function aiSettingsForm(db: Database, { ai, encryptionKey }: AiDependencies): Promise<AiSettingsForm> {
  const [{ state, version }, chat, embedding] = await Promise.all([
    storedAiSettings(db),
    listed(ai, "chat"),
    listed(ai, "embedding"),
  ]);
  const aiNow = aiStateOf(state, encryptionKey());
  const missing = aiNow.on ? [] : aiNow.missing;
  const keyUsable = !missing.includes("key");
  const offered = chat === "unavailable" || embedding === "unavailable" ? "unavailable" : { chat, embedding };
  const named = (id: string | undefined, models: ListedModel[] | "unavailable") =>
    id ? { id, name: models === "unavailable" ? undefined : models.find((model) => model.id === id)?.name } : undefined;
  return {
    version,
    aiOn: aiNow.on,
    missing,
    keyLastFour: keyUsable ? state.key?.lastFour : undefined,
    keyUnreadable: !aiNow.on && aiNow.keyUnreadable,
    chatModel: named(state.chatModel, chat),
    embeddingModel: named(state.embeddingModel, embedding),
    offered,
  };
}

import type { Decision } from "@/platform/command";
import { EMBEDDING_SIZE, type KeyCheck, type OfferedModel, type TestEmbedding } from "./ai-seam";
import type { EncryptedKey } from "./key-encryption";

/**
 * CMD-ChangeAiSettings (AGG-AiSettings, ST-104): a technician saves the museum's OpenRouter key, chooses the chat model
 * and the embedding model, or removes the key. What OpenRouter says about the key and the models is read before the
 * decision (`aiSettingsFacts`, through the AI seam); the decision only applies the rules to it.
 */

/** The ID of the AI settings – the one record, inserted without values by the migration `ai_settings`. */
export const AI_SETTINGS_ID = "7a1e0f40-0000-4000-8000-000000000104";

/** Who may change the AI settings – the allowed actors of CMD-ChangeAiSettings. */
export const aiSettingsActors = ["technician"] as const;

/** AGG-AiSettings: nothing saved until a technician saves something (singleton without a creating event). */
export type AiSettingsState = {
  id: string;
  /** Only encrypted (ADR 0014), with its last four characters – the only part of it ever shown again. */
  key?: { encrypted: EncryptedKey; lastFour: string };
  chatModel?: string;
  embeddingModel?: string;
};

/** What the technician sent: a new key and the models chosen or typed – or the one tap „Entfernen“. */
export type ChangeAiSettingsInput = {
  /** The version of the AI settings the technician saw (HS-16). */
  version: number;
  /** The key as typed – empty when none was entered. */
  key: string;
  chatModel?: string;
  embeddingModel?: string;
  /** „Entfernen“: the key is removed, the models stay (data model, lifecycle *On → Off*). */
  removeKey?: true;
  /**
   * „Embedding-Modell wechseln“ on the warning (ST-110): the technician saw what indexing every file again costs. A
   * saved embedding model is changed only with it (rule).
   */
  embeddingModelConfirmed?: true;
};

/** What OpenRouter said about the parts the technician sent – only those that differ from what is saved. */
export type AiSettingsFacts = {
  /** The new key, checked with OpenRouter – and encrypted when it was accepted. */
  key?: { check: "accepted"; encrypted: EncryptedKey } | { check: Exclude<KeyCheck, "accepted"> };
  chatModel?: OfferedModel | "unknown" | "unreachable";
  /** The embedding model and its test embedding – none without a key to send it with. */
  embeddingModel?: { model: OfferedModel | "unknown" | "unreachable"; test: TestEmbedding | "no-key" | undefined };
};

/** What a change touched – the journal names these, never the key. */
export type AiSettingsPart = "key-saved" | "key-removed" | "chat-model" | "embedding-model";

export type AiSettingsChanged = {
  type: "EVT-AiSettingsChanged";
  aiSettingsId: string;
  changedParts: AiSettingsPart[];
  keyLastFour: string | undefined;
  chatModel: string | undefined;
  embeddingModel: string | undefined;
  aiOn: boolean;
};

export type ChangeAiSettingsError =
  | "ai-key-refused"
  | "openrouter-unreachable"
  | "chat-model-unknown"
  | "chat-model-reads-no-images"
  | "embedding-model-unknown"
  | "embedding-model-reads-no-images"
  | "embedding-model-wrong-size"
  | "embedding-model-needs-key"
  | "embedding-model-change-unconfirmed";

/** AI is on exactly while a key, a chat model and an embedding model are saved (invariant). */
export function aiOn(settings: Pick<AiSettingsState, "key" | "chatModel" | "embeddingModel">): boolean {
  return !!settings.key && !!settings.chatModel && !!settings.embeddingModel;
}

/** The new key as the technician typed it, without surrounding spaces – undefined when none was entered. */
export function newKeyOf(input: Pick<ChangeAiSettingsInput, "key">): string | undefined {
  return input.key.trim() || undefined;
}

/** The model the technician sent when it differs from the saved one – only that one is checked and saved. */
export function changedModel(saved: string | undefined, sent: string | undefined): string | undefined {
  const model = sent?.trim();
  return model && model !== saved ? model : undefined;
}

type Rejection = { ok: false; error: ChangeAiSettingsError };
const rejected = (error: ChangeAiSettingsError): Rejection => ({ ok: false, error });

/** A changed model always has its fact – one without is a bug in the facts, never "fits". */
function missingFact(): never {
  throw new Error("CMD-ChangeAiSettings: a changed model was not checked with OpenRouter");
}

function chatModelRefusal(model: AiSettingsFacts["chatModel"]): ChangeAiSettingsError | undefined {
  if (model === undefined) return missingFact();
  if (model === "unreachable") return "openrouter-unreachable";
  if (model === "unknown") return "chat-model-unknown";
  return model.readsTextAndImages ? undefined : "chat-model-reads-no-images";
}

function embeddingModelRefusal(facts: AiSettingsFacts["embeddingModel"]): ChangeAiSettingsError | undefined {
  if (facts === undefined) return missingFact();
  const { model, test } = facts;
  if (model === "unreachable") return "openrouter-unreachable";
  if (model === "unknown") return "embedding-model-unknown";
  if (!model.readsTextAndImages) return "embedding-model-reads-no-images";
  // The size is known only from a test embedding, which needs a key (user, 2026-11-01).
  if (test === undefined || test === "no-key") return "embedding-model-needs-key";
  if (test === "unreachable") return "openrouter-unreachable";
  if (test === "refused") return "ai-key-refused";
  if (test === "unknown") return "embedding-model-unknown";
  return test.size === EMBEDDING_SIZE ? undefined : "embedding-model-wrong-size";
}

export function changeAiSettings(
  settings: AiSettingsState,
  input: ChangeAiSettingsInput,
  _context: unknown,
  facts: AiSettingsFacts,
): Decision<AiSettingsState, AiSettingsChanged, ChangeAiSettingsError> {
  if (input.removeKey) {
    // Removing a key that is not there changes nothing (HS-27).
    if (!settings.key) return { ok: true, state: settings, events: [] };
    return changed({ ...settings, key: undefined }, ["key-removed"]);
  }

  const newKey = newKeyOf(input);
  let key = settings.key;
  if (newKey) {
    if (facts.key?.check === "refused") return rejected("ai-key-refused");
    if (facts.key?.check !== "accepted") return rejected("openrouter-unreachable");
    key = { encrypted: facts.key.encrypted, lastFour: newKey.slice(-4) };
  }

  const chatModel = changedModel(settings.chatModel, input.chatModel);
  const chatRefusal = chatModel ? chatModelRefusal(facts.chatModel) : undefined;
  if (chatRefusal) return rejected(chatRefusal);

  const embeddingModel = changedModel(settings.embeddingModel, input.embeddingModel);
  const embeddingRefusal = embeddingModel ? embeddingModelRefusal(facts.embeddingModel) : undefined;
  if (embeddingRefusal) return rejected(embeddingRefusal);
  // Changing a saved embedding model indexes every file again – only after the warning with its cost (rule, ST-110).
  // The first embedding model indexes too, but nothing is indexed with another one yet: no warning.
  if (embeddingModel && settings.embeddingModel && !input.embeddingModelConfirmed)
    return rejected("embedding-model-change-unconfirmed");

  const parts: AiSettingsPart[] = [
    ...(newKey ? (["key-saved"] as const) : []),
    ...(chatModel ? (["chat-model"] as const) : []),
    ...(embeddingModel ? (["embedding-model"] as const) : []),
  ];
  // A save that changes nothing records no event (HS-27).
  if (parts.length === 0) return { ok: true, state: settings, events: [] };
  return changed(
    {
      ...settings,
      key,
      chatModel: chatModel ?? settings.chatModel,
      embeddingModel: embeddingModel ?? settings.embeddingModel,
    },
    parts,
  );
}

function changed(
  after: AiSettingsState,
  changedParts: AiSettingsPart[],
): Decision<AiSettingsState, AiSettingsChanged, ChangeAiSettingsError> {
  return {
    ok: true,
    state: after,
    events: [
      {
        type: "EVT-AiSettingsChanged",
        aiSettingsId: after.id,
        changedParts,
        keyLastFour: after.key?.lastFour,
        chatModel: after.chatModel,
        embeddingModel: after.embeddingModel,
        aiOn: aiOn(after),
      },
    ],
  };
}

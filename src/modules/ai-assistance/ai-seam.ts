/**
 * The AI seam (ADR 0014): the only way AI assistance talks to OpenRouter. `openRouter()` (`openrouter.ts`) is the real
 * adapter over OpenRouter's HTTP API, `memoryAi()` (`ai-seam.test-support.ts`) the in-memory stand-in for tests. It is
 * the anti-corruption layer of the context map: OpenRouter's answers come back as the domain's words.
 */

/** Which of the two models of the AI settings. */
export type ModelKind = "chat" | "embedding";

/** A model OpenRouter offers (RM-AiSettings: name, context size and price per million tokens). */
export type OfferedModel = {
  id: string;
  name: string;
  /** Tokens. */
  contextLength: number;
  /** US dollars per million tokens – an embedding model has an input price only. */
  pricePerMillion: { input: number; output?: number };
  /** The chat model and the embedding model must read text and images (rule of CMD-ChangeAiSettings). */
  readsTextAndImages: boolean;
};

export type KeyCheck = "accepted" | "refused" | "unreachable";

export type TestEmbedding = { size: number } | "refused" | "unknown" | "unreachable";

export type AiSeam = {
  /** The models of one kind OpenRouter offers now – "unavailable" when the list cannot be loaded. */
  offeredModels(kind: ModelKind): Promise<OfferedModel[] | "unavailable">;
  /** One model of one kind, typed or chosen – "unknown" when OpenRouter offers no such model of that kind. */
  model(kind: ModelKind, id: string): Promise<OfferedModel | "unknown" | "unreachable">;
  /** Whether OpenRouter accepts the key. */
  checkKey(key: string): Promise<KeyCheck>;
  /** One short test embedding of 1536 numbers asked for – how many came back. */
  testEmbedding(key: string, model: string): Promise<TestEmbedding>;
};

/** The size of an embedding in the AI index (ADR 0014, HS-34). */
export const EMBEDDING_SIZE = 1536;

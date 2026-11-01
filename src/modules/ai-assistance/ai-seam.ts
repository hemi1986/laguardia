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

/** What one embedding request embeds – one item per request, never several (ST-105: only so it stays zero-data-retention). */
export type EmbedInput = { kind: "text"; text: string } | { kind: "image"; bytes: Uint8Array; contentType: string };

/** One embedding the AI index keeps, and what OpenRouter charged for its request (ST-106). */
export type Embedding = { embedding: number[]; cost: number };

/** One embedding request's answer – OpenRouter's refusal or its silence as the domain's reasons. */
export type EmbedResult = Embedding | "refused" | "unreachable";

export type AiSeam = {
  /** The models of one kind OpenRouter offers now – "unavailable" when the list cannot be loaded. */
  offeredModels(kind: ModelKind): Promise<OfferedModel[] | "unavailable">;
  /** One model of one kind, typed or chosen – "unknown" when OpenRouter offers no such model of that kind. */
  model(kind: ModelKind, id: string): Promise<OfferedModel | "unknown" | "unreachable">;
  /** Whether OpenRouter accepts the key. */
  checkKey(key: string): Promise<KeyCheck>;
  /** One short test embedding of 1536 numbers asked for – how many came back. */
  testEmbedding(key: string, model: string): Promise<TestEmbedding>;
  /**
   * Embeds one item – a text passage or an image – with the embedding model (ST-106). Every request asks only for
   * providers that neither keep nor train on the data (ADR 0014); one item per request keeps it so (ST-105).
   */
  embed(key: string, model: string, input: EmbedInput): Promise<EmbedResult>;
};

/** The size of an embedding in the AI index (ADR 0014, HS-34). */
export const EMBEDDING_SIZE = 1536;

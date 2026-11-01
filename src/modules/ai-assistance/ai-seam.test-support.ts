import type { AiSeam, ModelKind, OfferedModel } from "./ai-seam";

/** A model the in-memory OpenRouter offers – with the size of the embeddings it returns, for an embedding model. */
export type MemoryModel = OfferedModel & { kind: ModelKind; embeddingSize?: number };

export const geminiFlash: MemoryModel = {
  kind: "chat",
  id: "google/gemini-2.5-flash",
  name: "Gemini 2.5 Flash",
  contextLength: 1_048_576,
  pricePerMillion: { input: 0.3, output: 2.5 },
  readsTextAndImages: true,
};

export const geminiEmbedding: MemoryModel = {
  kind: "embedding",
  id: "google/gemini-embedding-2",
  name: "Gemini Embedding 2",
  contextLength: 8192,
  pricePerMillion: { input: 0.15 },
  readsTextAndImages: true,
  embeddingSize: 1536,
};

/** The in-memory OpenRouter's settings: the models it knows, the keys it accepts, and what is unreachable. */
export type MemoryAiSettings = {
  models?: MemoryModel[];
  acceptedKeys?: string[];
  /** The model lists cannot be loaded – a single model can still be looked up. */
  listsUnavailable?: boolean;
  /** Nothing answers. */
  unreachable?: boolean;
};

/**
 * The AI seam in memory (ADR 0014, ST-104) – what every scenario test uses instead of OpenRouter. `requests` lists
 * what was asked, by kind, never the key.
 */
export function memoryAi(settings: MemoryAiSettings = {}): AiSeam & { requests: string[] } {
  const models = settings.models ?? [geminiFlash, geminiEmbedding];
  const accepted = new Set(settings.acceptedKeys ?? []);
  const requests: string[] = [];
  const offered = (model: MemoryModel): OfferedModel => ({
    id: model.id,
    name: model.name,
    contextLength: model.contextLength,
    pricePerMillion: model.pricePerMillion,
    readsTextAndImages: model.readsTextAndImages,
  });
  return {
    requests,
    async offeredModels(kind) {
      requests.push(`models:${kind}`);
      if (settings.unreachable || settings.listsUnavailable) return "unavailable";
      return models.filter((model) => model.kind === kind).map(offered);
    },
    async model(kind, id) {
      requests.push(`model:${kind}:${id}`);
      if (settings.unreachable) return "unreachable";
      const model = models.find((candidate) => candidate.kind === kind && candidate.id === id);
      return model ? offered(model) : "unknown";
    },
    async checkKey(key) {
      requests.push("key");
      if (settings.unreachable) return "unreachable";
      return accepted.has(key) ? "accepted" : "refused";
    },
    async testEmbedding(key, id) {
      requests.push(`embedding:${id}`);
      if (settings.unreachable) return "unreachable";
      if (!accepted.has(key)) return "refused";
      const model = models.find((candidate) => candidate.kind === "embedding" && candidate.id === id);
      return model ? { size: model.embeddingSize ?? 1536 } : "unknown";
    },
  };
}

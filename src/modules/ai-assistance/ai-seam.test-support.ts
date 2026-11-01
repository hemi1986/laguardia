import {
  EMBEDDING_SIZE,
  type AiSeam,
  type ChatAnswer,
  type ChatInput,
  type EmbedInput,
  type ModelKind,
  type OfferedModel,
} from "./ai-seam";

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
  /** What one embedding request costs – the AI index records the sum (ST-106). */
  embeddingCost?: number;
  /** How many embedding requests it answers before failing – and with what ("after the first 2 pages"). */
  embedFailsAfter?: { requests: number; with: "refused" | "unreachable" };
  /** Called before each embedding request is answered – a test can change things meanwhile (turning AI off, ST-106). */
  beforeEmbed?: (requestNumber: number, input: EmbedInput) => Promise<void> | void;
  /** What the chat model answers to an AI assessment (ST-107) – its content and cost, or a failure. */
  chatAnswer?: ChatAnswer | ((request: ChatRequest, number: number) => ChatAnswer);
  /** What one chat request asked – recorded for the scenarios that check what was sent (ST-107). */
  beforeChat?: (request: ChatRequest, number: number) => Promise<void> | void;
};

/** One chat request the in-memory OpenRouter received – everything CMD-WriteAiAssessment sent (ST-107). */
export type ChatRequest = ChatInput & { key: string; model: string };

/** A default answer the structured-answer parser reads – a summary only, unless a test says otherwise. */
const defaultChatAnswer: ChatAnswer = {
  content: JSON.stringify({
    summary: "Der linke Flipperfinger wird schwach.",
    probableCauses: [],
    whatToCheckFirst: [],
  }),
  cost: 0.04,
};

/**
 * The AI seam in memory (ADR 0014, ST-104) – what every scenario test uses instead of OpenRouter. `requests` lists
 * what was asked, by kind, never the key; `costs` is what it reported for each embedding, summed – the number the AI
 * index records (ST-106). `chatRequests` holds every chat request of an AI assessment (ST-107).
 */
export function memoryAi(settings: MemoryAiSettings = {}): AiSeam & {
  requests: string[];
  embedInputs: EmbedInput[];
  chatRequests: ChatRequest[];
  reportedCost: number;
  embeddingRequests: number;
} {
  const models = settings.models ?? [geminiFlash, geminiEmbedding];
  const accepted = new Set(settings.acceptedKeys ?? []);
  const requests: string[] = [];
  const embedInputs: EmbedInput[] = [];
  const chatRequests: ChatRequest[] = [];
  let reportedCost = 0;
  let embeddingRequests = 0;
  const offered = (model: MemoryModel): OfferedModel => ({
    id: model.id,
    name: model.name,
    contextLength: model.contextLength,
    pricePerMillion: model.pricePerMillion,
    readsTextAndImages: model.readsTextAndImages,
  });
  return {
    requests,
    embedInputs,
    chatRequests,
    get reportedCost() {
      return reportedCost;
    },
    get embeddingRequests() {
      return embeddingRequests;
    },
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
    async embed(key, id, input) {
      requests.push(`embed:${id}:${input.kind}`);
      embedInputs.push(input);
      embeddingRequests += 1;
      await settings.beforeEmbed?.(embeddingRequests, input);
      if (settings.unreachable) return "unreachable";
      const fails = settings.embedFailsAfter;
      if (fails && embeddingRequests > fails.requests) return fails.with;
      if (!accepted.has(key)) return "refused";
      const model = models.find((candidate) => candidate.kind === "embedding" && candidate.id === id);
      if (!model) return "refused";
      // A vector that is the same every time and differs by item: enough to tell entries apart in a test.
      const seed = requests.length;
      const cost = settings.embeddingCost ?? 0.0001;
      reportedCost += cost;
      return {
        embedding: Array.from({ length: EMBEDDING_SIZE }, (_, index) => ((seed * 31 + index) % 1000) / 1000),
        cost,
      };
    },
    async chat(key, model, input) {
      requests.push(`chat:${model}`);
      const request: ChatRequest = { ...input, key, model };
      chatRequests.push(request);
      await settings.beforeChat?.(request, chatRequests.length);
      if (settings.unreachable) return { failure: "openrouter-not-reachable" };
      if (!accepted.has(key)) return { failure: "key-invalid" };
      const answer = settings.chatAnswer;
      return typeof answer === "function" ? answer(request, chatRequests.length) : (answer ?? defaultChatAnswer);
    },
  };
}

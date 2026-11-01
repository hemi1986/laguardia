import {
  EMBEDDING_SIZE,
  type AiSeam,
  type EmbedResult,
  type ModelKind,
  type OfferedModel,
  type TestEmbedding,
} from "./ai-seam";

/**
 * The OpenRouter adapter of the AI seam (ADR 0014): the only code that talks to OpenRouter – over its HTTP API with
 * `fetch`, no SDK. Every request that sends data asks only for providers that neither keep nor train on it. The key is
 * sent only in the `Authorization` header and never logged.
 */

type ApiModel = {
  id: string;
  name: string;
  context_length?: number | null;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
  endpoints?: { context_length?: number | null; pricing?: { prompt?: string; completion?: string } }[];
};

const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 10_000;
/** Embedding a page image takes longer than reading a model list: the request itself may take this long (ST-105). */
const EMBED_TIMEOUT_MS = 60_000;

/** What OpenRouter's lists name the output of each kind. */
const outputOf: Record<ModelKind, string> = { chat: "text", embedding: "embeddings" };

/**
 * A model ID as OpenRouter writes it – `author/slug`, optionally `:variant`, an alias with a leading `~`
 * (`~google/gemini-flash-latest`) – so a typed ID cannot reach another address.
 */
const MODEL_ID = /^~?[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(:[a-z0-9._-]+)?$/i;

/** US dollars per token as OpenRouter gives it → per million tokens, without the float's noise. */
function perMillion(perToken: string | undefined): number {
  const value = Number(perToken ?? "0") * 1_000_000;
  return Number.isFinite(value) ? Number(value.toPrecision(12)) : 0;
}

/** The model's name without the author OpenRouter puts before it: „Google: Gemini 2.5 Flash“ → „Gemini 2.5 Flash“. */
function nameOf(model: ApiModel): string {
  const colon = model.name.indexOf(": ");
  return colon > 0 ? model.name.slice(colon + 2) : model.name;
}

/** A router (`openrouter/auto`) has no price of its own – OpenRouter gives -1; it is not offered in the list. */
const pricedBeforehand = (model: ApiModel) =>
  Number(model.pricing?.prompt ?? "0") >= 0 && Number(model.pricing?.completion ?? "0") >= 0;

function offeredModel(model: ApiModel, kind: ModelKind): OfferedModel {
  const endpoint = model.endpoints?.[0];
  const pricing = model.pricing ?? endpoint?.pricing ?? {};
  const inputs = model.architecture?.input_modalities ?? [];
  return {
    id: model.id,
    name: nameOf(model),
    contextLength: model.context_length ?? endpoint?.context_length ?? 0,
    pricePerMillion:
      kind === "chat"
        ? { input: perMillion(pricing.prompt), output: perMillion(pricing.completion) }
        : { input: perMillion(pricing.prompt) },
    readsTextAndImages: inputs.includes("text") && inputs.includes("image"),
  };
}

const isOfKind = (model: ApiModel, kind: ModelKind) =>
  (model.architecture?.output_modalities ?? []).includes(outputOf[kind]);

/**
 * `OPENROUTER_BASE_URL` is for the local browser tests only (`scripts/e2e-server.ts`, where nothing answers); production
 * ignores it, so the museum's key never goes to another host there.
 */
function configuredBaseUrl(): string {
  if (process.env.VERCEL_ENV === "production") return DEFAULT_BASE_URL;
  return process.env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL;
}

export function openRouter({ baseUrl = configuredBaseUrl() }: { baseUrl?: string } = {}): AiSeam {
  /** A request – undefined when OpenRouter cannot be reached at all. */
  async function request(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<Response | undefined> {
    try {
      // A redirect is never followed – a request may carry the key.
      return await fetch(`${baseUrl}${path}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      return undefined;
    }
  }
  const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

  return {
    async offeredModels(kind) {
      const response = await request(kind === "chat" ? "/models" : "/embeddings/models");
      if (!response?.ok) return "unavailable";
      try {
        const { data } = (await response.json()) as { data: ApiModel[] };
        return data
          .filter((model) => isOfKind(model, kind) && pricedBeforehand(model))
          .map((model) => offeredModel(model, kind));
      } catch {
        return "unavailable";
      }
    },

    async model(kind, id) {
      if (!MODEL_ID.test(id)) return "unknown";
      const response = await request(`/models/${id}/endpoints`);
      if (!response) return "unreachable";
      if (response.status === 404 || response.status === 400) return "unknown";
      if (!response.ok) return "unreachable";
      try {
        const { data } = (await response.json()) as { data: ApiModel };
        return isOfKind(data, kind) ? offeredModel(data, kind) : "unknown";
      } catch {
        return "unreachable";
      }
    },

    async checkKey(key) {
      const response = await request("/key", { headers: bearer(key) });
      if (!response) return "unreachable";
      if (response.status === 401 || response.status === 403) return "refused";
      return response.ok ? "accepted" : "unreachable";
    },

    async testEmbedding(key, model): Promise<TestEmbedding> {
      const response = await request("/embeddings", {
        method: "POST",
        headers: { ...bearer(key), "content-type": "application/json" },
        body: JSON.stringify({
          model,
          input: "Flipper",
          dimensions: EMBEDDING_SIZE,
          encoding_format: "float",
          provider: { data_collection: "deny", zdr: true },
        }),
      });
      if (!response) return "unreachable";
      if (response.status === 401 || response.status === 402 || response.status === 403) return "refused";
      // OpenRouter answers a model it does not have – or one without a provider that keeps nothing – with 400 or 404.
      if (response.status === 400 || response.status === 404) return "unknown";
      if (!response.ok) return "unreachable";
      try {
        const { data } = (await response.json()) as { data: { embedding: number[] }[] };
        const embedding = data[0]?.embedding;
        return Array.isArray(embedding) ? { size: embedding.length } : "unreachable";
      } catch {
        return "unreachable";
      }
    },

    async embed(key, model, input): Promise<EmbedResult> {
      const response = await request(
        "/embeddings",
        {
          method: "POST",
          headers: { ...bearer(key), "content-type": "application/json" },
          body: JSON.stringify({
            model,
            // One item per request: OpenRouter routes several inputs to an endpoint without zero data retention (ST-105).
            input:
              input.kind === "text"
                ? input.text
                : [
                    {
                      content: [
                        {
                          type: "image_url",
                          image_url: {
                            url: `data:${input.contentType};base64,${Buffer.from(input.bytes).toString("base64")}`,
                          },
                        },
                      ],
                    },
                  ],
            dimensions: EMBEDDING_SIZE,
            encoding_format: "float",
            provider: { data_collection: "deny", zdr: true },
          }),
        },
        EMBED_TIMEOUT_MS,
      );
      if (!response) return "unreachable";
      // A refusal – the key, the credits, the model or a provider that keeps nothing – stores nothing of the file.
      if (!response.ok) return "refused";
      try {
        const { data, usage } = (await response.json()) as {
          data: { embedding: number[] }[];
          usage?: { cost?: number };
        };
        const embedding = data[0]?.embedding;
        if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_SIZE) return "refused";
        const cost = usage?.cost;
        return { embedding, cost: typeof cost === "number" && Number.isFinite(cost) ? cost : 0 };
      } catch {
        return "refused";
      }
    },
  };
}

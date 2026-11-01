import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { openRouter } from "./openrouter";

/**
 * The OpenRouter adapter (ADR 0014) against a fake HTTP server that answers like OpenRouter's API (seam decided by the
 * user, ST-104 test plan) – never the real API. It checks the requests the adapter sends and how it turns the answers
 * into the domain's words.
 */
type Answer = { status: number; body?: unknown };
type Received = { method: string; path: string; authorization: string | undefined; body: unknown };

let server: Server;
let baseUrl: string;
let answers: Record<string, Answer> = {};
let received: Received[] = [];

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  let text = "";
  for await (const chunk of request) text += chunk;
  return text ? JSON.parse(text) : undefined;
}

beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = request.url ?? "";
    received.push({
      method: request.method ?? "",
      path,
      authorization: request.headers.authorization,
      body: await bodyOf(request),
    });
    const answer = answers[`${request.method} ${path}`] ?? { status: 404, body: { error: { message: "Not found" } } };
    response.writeHead(answer.status, { "content-type": "application/json" });
    response.end(answer.body === undefined ? "" : JSON.stringify(answer.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

afterEach(() => {
  answers = {};
  received = [];
});

const adapter = () => openRouter({ baseUrl });

const geminiFlash = {
  id: "google/gemini-2.5-flash",
  name: "Google: Gemini 2.5 Flash",
  context_length: 1048576,
  architecture: { input_modalities: ["file", "image", "text"], output_modalities: ["text"] },
  pricing: { prompt: "0.0000003", completion: "0.0000025" },
};
const textChat = {
  id: "text/chat",
  name: "Text Chat",
  context_length: 8192,
  architecture: { input_modalities: ["text"], output_modalities: ["text"] },
  pricing: { prompt: "0.000001", completion: "0.000002" },
};
const imageMaker = {
  id: "image/maker",
  name: "Image Maker",
  context_length: 8192,
  architecture: { input_modalities: ["text", "image"], output_modalities: ["image"] },
  pricing: { prompt: "0.000001", completion: "0.000002" },
};
const geminiEmbedding = {
  id: "google/gemini-embedding-2",
  name: "Google: Gemini Embedding 2",
  context_length: 8192,
  architecture: { input_modalities: ["text", "image", "file"], output_modalities: ["embeddings"] },
  pricing: { prompt: "0.0000002", completion: "0", image: "0.00000045" },
};

describe("the OpenRouter adapter", () => {
  it("lists the chat models that write text, with context size and prices per million tokens", async () => {
    answers["GET /api/v1/models"] = { status: 200, body: { data: [geminiFlash, textChat, imageMaker] } };

    expect(await adapter().offeredModels("chat")).toEqual([
      {
        id: "google/gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        contextLength: 1048576,
        pricePerMillion: { input: 0.3, output: 2.5 },
        readsTextAndImages: true,
      },
      {
        id: "text/chat",
        name: "Text Chat",
        contextLength: 8192,
        pricePerMillion: { input: 1, output: 2 },
        readsTextAndImages: false,
      },
    ]);
    expect(received[0].authorization).toBeUndefined();
  });

  it("lists the embedding models with an input price only", async () => {
    answers["GET /api/v1/embeddings/models"] = { status: 200, body: { data: [geminiEmbedding] } };

    expect(await adapter().offeredModels("embedding")).toEqual([
      {
        id: "google/gemini-embedding-2",
        name: "Gemini Embedding 2",
        contextLength: 8192,
        pricePerMillion: { input: 0.2 },
        readsTextAndImages: true,
      },
    ]);
  });

  it("says the list is unavailable when OpenRouter fails or cannot be reached", async () => {
    answers["GET /api/v1/models"] = { status: 503, body: { error: { message: "down" } } };

    expect(await adapter().offeredModels("chat")).toBe("unavailable");
    expect(await openRouter({ baseUrl: "http://127.0.0.1:1/api/v1" }).offeredModels("embedding")).toBe("unavailable");
  });

  it("looks up one model by its ID, of the kind asked for", async () => {
    answers["GET /api/v1/models/google/gemini-embedding-2/endpoints"] = {
      status: 200,
      body: { data: { ...geminiEmbedding, endpoints: [{ context_length: 8192, pricing: geminiEmbedding.pricing }] } },
    };

    expect(await adapter().model("embedding", "google/gemini-embedding-2")).toMatchObject({
      id: "google/gemini-embedding-2",
      readsTextAndImages: true,
      pricePerMillion: { input: 0.2 },
    });
    // An embedding model is no chat model.
    expect(await adapter().model("chat", "google/gemini-embedding-2")).toBe("unknown");
    expect(await adapter().model("chat", "nobody/nothing")).toBe("unknown");
    expect(await openRouter({ baseUrl: "http://127.0.0.1:1/api/v1" }).model("chat", "x/y")).toBe("unreachable");
  });

  it("looks up an alias ID with a leading tilde, as OpenRouter's list offers it", async () => {
    answers["GET /api/v1/models/~google/gemini-flash-latest/endpoints"] = {
      status: 200,
      body: { data: { ...geminiFlash, id: "~google/gemini-flash-latest" } },
    };

    expect(await adapter().model("chat", "~google/gemini-flash-latest")).toMatchObject({
      id: "~google/gemini-flash-latest",
    });
  });

  it("leaves out router models whose price is not known beforehand, and drops the author from a name", async () => {
    const router = { ...geminiFlash, id: "openrouter/auto", name: "Auto Router", pricing: { prompt: "-1", completion: "-1" } };
    answers["GET /api/v1/models"] = { status: 200, body: { data: [geminiFlash, router] } };

    expect(await adapter().offeredModels("chat")).toEqual([
      expect.objectContaining({ id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" }),
    ]);
  });

  it("does not follow a redirect with the key", async () => {
    answers["GET /api/v1/key"] = { status: 307, body: {} };

    expect(await adapter().checkKey("sk-or-v1-good")).toBe("unreachable");
  });

  it("does not let a typed model ID reach another address", async () => {
    expect(await adapter().model("chat", "../key")).toBe("unknown");
    expect(await adapter().model("chat", "a/b?c")).toBe("unknown");
    expect(received).toEqual([]);
  });

  it("checks a key with OpenRouter", async () => {
    answers["GET /api/v1/key"] = { status: 200, body: { data: { label: "sk-or-v1-abc...a1b2" } } };

    expect(await adapter().checkKey("sk-or-v1-good")).toBe("accepted");
    expect(received[0].authorization).toBe("Bearer sk-or-v1-good");

    answers["GET /api/v1/key"] = { status: 401, body: { error: { message: "User not found.", code: 401 } } };
    expect(await adapter().checkKey("sk-or-v1-bad")).toBe("refused");

    answers["GET /api/v1/key"] = { status: 502, body: { error: { message: "bad gateway" } } };
    expect(await adapter().checkKey("sk-or-v1-good")).toBe("unreachable");
    expect(await openRouter({ baseUrl: "http://127.0.0.1:1/api/v1" }).checkKey("sk-or-v1-good")).toBe("unreachable");
  });

  it("sends one short test embedding of 1536 numbers, only to providers that neither keep nor train on the data", async () => {
    answers["POST /api/v1/embeddings"] = {
      status: 200,
      body: {
        object: "list",
        model: "google/gemini-embedding-2",
        data: [{ object: "embedding", index: 0, embedding: Array(1536).fill(0.1) }],
      },
    };

    expect(await adapter().testEmbedding("sk-or-v1-good", "google/gemini-embedding-2")).toEqual({ size: 1536 });
    expect(received[0]).toMatchObject({
      authorization: "Bearer sk-or-v1-good",
      body: {
        model: "google/gemini-embedding-2",
        dimensions: 1536,
        encoding_format: "float",
        provider: { data_collection: "deny", zdr: true },
      },
    });
    expect(typeof (received[0].body as { input: unknown }).input).toBe("string");
  });

  it.each([[768, { size: 768 }]])("reports the size of an embedding of %i numbers", async (size, expected) => {
    answers["POST /api/v1/embeddings"] = {
      status: 200,
      body: { object: "list", model: "m", data: [{ embedding: Array(size).fill(0) }] },
    };

    expect(await adapter().testEmbedding("k", "small/embedding")).toEqual(expected);
  });

  it.each([
    [401, "refused"],
    [400, "unknown"],
    [404, "unknown"],
    [500, "unreachable"],
  ])("turns a test embedding answered with %i into %s", async (status, expected) => {
    answers["POST /api/v1/embeddings"] = { status, body: { error: { message: "no" } } };

    expect(await adapter().testEmbedding("k", "x/y")).toBe(expected);
  });
});

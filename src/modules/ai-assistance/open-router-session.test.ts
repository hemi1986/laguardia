import { describe, expect, it } from "vitest";
import type { AiState } from "./ai-settings";
import type { ChatAnswer, EmbedResult } from "./ai-seam";
import { openRouterSession } from "./open-router-session";

const text = { kind: "text", text: "Left flipper weak" } as const;
const chatInput = { system: "", text: "", images: [] };
const on = (key = "k1", embeddingModel = "e1"): AiState => ({ on: true, key, chatModel: "c1", embeddingModel });
const off: AiState = { on: false, missing: ["key"], keyUnreadable: false };

function aSession({
  ai = on(),
  embedded = { embedding: [1], cost: 0.01 },
  answered = { content: "{}", cost: 0.04 },
}: { ai?: AiState | (() => AiState); embedded?: EmbedResult; answered?: ChatAnswer } = {}) {
  const sent: string[] = [];
  const recorded: number[] = [];
  const session = openRouterSession({
    ai: {
      embed: async (key, model) => (sent.push(`embed ${key} ${model}`), embedded),
      chat: async (key, model) => (sent.push(`chat ${key} ${model}`), answered),
    },
    readAiNow: async () => (typeof ai === "function" ? ai() : ai),
    recordSpent: async (cost) => void recorded.push(cost),
  });
  return { session, sent, recorded };
}

describe("an OpenRouter session of a held piece", () => {
  it("sends nothing while AI is off", async () => {
    const { session, sent } = aSession({ ai: off });
    expect(await session.embed(text)).toBe("stopped");
    expect(await session.chat("c1", chatInput)).toBe("stopped");
    expect(sent).toEqual([]);
  });

  it("uses a rotated key from the next request on", async () => {
    const keys = [on("k1"), on("k2")];
    const { session, sent } = aSession({ ai: () => keys.shift()! });
    await session.embed(text);
    await session.embed(text);
    expect(sent).toEqual(["embed k1 e1", "embed k2 e1"]);
  });

  it("follows a changed embedding model and names it – unless the request is pinned to the one it started with", async () => {
    const { session, sent } = aSession({ ai: on("k1", "e2") });
    expect(await session.embed(text)).toMatchObject({ model: "e2" });
    expect(await session.embed(text, { sameModel: "e1" })).toBe("stopped");
    expect(await session.embed(text, { sameModel: "e2" })).toMatchObject({ model: "e2" });
    expect(sent).toEqual(["embed k1 e2", "embed k1 e2"]);
  });

  it("sends a chat request with the model given, not the saved one", async () => {
    const { session, sent } = aSession();
    await session.chat("requested-with", chatInput);
    expect(sent).toEqual(["chat k1 requested-with"]);
  });

  it("records each request's cost as it comes and sums it", async () => {
    const { session, recorded } = aSession();
    await session.embed(text);
    await session.chat("c1", chatInput);
    expect(recorded).toEqual([0.01, 0.04]);
    expect(session.spent()).toBeCloseTo(0.05);
  });

  it("records nothing for a free request, a refusal or a failed chat", async () => {
    const free = aSession({ embedded: { embedding: [1], cost: 0 } });
    await free.session.embed(text);
    const refused = aSession({ embedded: "refused", answered: { failure: "key-invalid" } });
    expect(await refused.session.embed(text)).toBe("refused");
    expect(await refused.session.chat("c1", chatInput)).toEqual({ failure: "key-invalid" });
    expect([...free.recorded, ...refused.recorded]).toEqual([]);
    expect(refused.session.spent()).toBe(0);
  });
});

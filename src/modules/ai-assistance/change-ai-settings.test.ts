import { describe, expect, it } from "vitest";
import type { OfferedModel } from "./ai-seam";
import { AI_SETTINGS_ID, changeAiSettings, type AiSettingsFacts, type AiSettingsState } from "./change-ai-settings";

/** The rules of CMD-ChangeAiSettings (ST-104) on what OpenRouter said – a table, because they have many cases. */
const nothingSaved: AiSettingsState = { id: AI_SETTINGS_ID };
const allSaved: AiSettingsState = {
  id: AI_SETTINGS_ID,
  key: { encrypted: "v1:x:y:z", lastFour: "a1b2" },
  chatModel: "google/gemini-2.5-flash",
  embeddingModel: "google/gemini-embedding-2",
};
const model = (readsTextAndImages = true): OfferedModel => ({
  id: "m",
  name: "M",
  contextLength: 1,
  pricePerMillion: { input: 1 },
  readsTextAndImages,
});
const accepted = { check: "accepted", encrypted: "v1:new" } as const;
const fitting = { model: model(), test: { size: 1536 } } as const;
const input = (parts: { key?: string; chatModel?: string; embeddingModel?: string; removeKey?: true }) => ({
  version: 0,
  key: "",
  ...parts,
});

describe("CMD-ChangeAiSettings decides", () => {
  it.each<[string, AiSettingsState, ReturnType<typeof input>, AiSettingsFacts, string]>([
    ["a key OpenRouter refuses", nothingSaved, input({ key: "k" }), { key: { check: "refused" } }, "ai-key-refused"],
    [
      "a key OpenRouter cannot check",
      nothingSaved,
      input({ key: "k" }),
      { key: { check: "unreachable" } },
      "openrouter-unreachable",
    ],
    [
      "an unknown chat model",
      nothingSaved,
      input({ chatModel: "x/y" }),
      { chatModel: "unknown" },
      "chat-model-unknown",
    ],
    [
      "a chat model that reads text only",
      nothingSaved,
      input({ chatModel: "x/y" }),
      { chatModel: model(false) },
      "chat-model-reads-no-images",
    ],
    [
      "a chat model OpenRouter cannot look up",
      nothingSaved,
      input({ chatModel: "x/y" }),
      { chatModel: "unreachable" },
      "openrouter-unreachable",
    ],
    [
      "an unknown embedding model",
      nothingSaved,
      input({ key: "k", embeddingModel: "x/y" }),
      { key: accepted, embeddingModel: { model: "unknown", test: undefined } },
      "embedding-model-unknown",
    ],
    [
      "an embedding model that reads text only",
      nothingSaved,
      input({ key: "k", embeddingModel: "x/y" }),
      { key: accepted, embeddingModel: { model: model(false), test: undefined } },
      "embedding-model-reads-no-images",
    ],
    [
      "an embedding model of 768 numbers",
      nothingSaved,
      input({ key: "k", embeddingModel: "x/y" }),
      { key: accepted, embeddingModel: { model: model(), test: { size: 768 } } },
      "embedding-model-wrong-size",
    ],
    [
      "an embedding model without a key",
      nothingSaved,
      input({ embeddingModel: "x/y" }),
      { embeddingModel: { model: model(), test: "no-key" } },
      "embedding-model-needs-key",
    ],
    [
      "a test embedding that cannot be sent",
      nothingSaved,
      input({ key: "k", embeddingModel: "x/y" }),
      { key: accepted, embeddingModel: { model: model(), test: "unreachable" } },
      "openrouter-unreachable",
    ],
    [
      "a refused key before an unfitting chat model",
      nothingSaved,
      input({ key: "k", chatModel: "x/y" }),
      { key: { check: "refused" }, chatModel: model(false) },
      "ai-key-refused",
    ],
    [
      "an unfitting chat model before an unfitting embedding model",
      nothingSaved,
      input({ key: "k", chatModel: "x/y", embeddingModel: "a/b" }),
      { key: accepted, chatModel: model(false), embeddingModel: { model: model(false), test: undefined } },
      "chat-model-reads-no-images",
    ],
  ])("rejects %s", (_case, state, sent, facts, error) => {
    expect(changeAiSettings(state, sent, undefined, facts)).toEqual({ ok: false, error });
  });

  it("saves only a key: AI stays off, the event names the key's last four characters", () => {
    const decision = changeAiSettings(nothingSaved, input({ key: "  sk-or-v1-xyza1b2 " }), undefined, {
      key: accepted,
    });

    expect(decision).toMatchObject({
      ok: true,
      state: { key: { encrypted: "v1:new", lastFour: "a1b2" } },
      events: [{ changedParts: ["key-saved"], keyLastFour: "a1b2", aiOn: false }],
    });
  });

  it("saves the chat model without a key", () => {
    const decision = changeAiSettings(nothingSaved, input({ chatModel: "x/y" }), undefined, { chatModel: model() });

    expect(decision).toMatchObject({
      ok: true,
      events: [{ changedParts: ["chat-model"], chatModel: "x/y", aiOn: false }],
    });
  });

  it("turns AI on with a key and both models", () => {
    const decision = changeAiSettings(
      nothingSaved,
      input({ key: "sk-a1b2", chatModel: "c/c", embeddingModel: "e/e" }),
      undefined,
      { key: accepted, chatModel: model(), embeddingModel: fitting },
    );

    expect(decision).toMatchObject({
      ok: true,
      events: [{ changedParts: ["key-saved", "chat-model", "embedding-model"], aiOn: true }],
    });
  });

  it("does not check a model that is sent as it is saved, and records nothing when nothing changed", () => {
    const sent = input({ chatModel: allSaved.chatModel, embeddingModel: allSaved.embeddingModel });

    expect(changeAiSettings(allSaved, sent, undefined, {})).toEqual({ ok: true, state: allSaved, events: [] });
  });

  it("removes the key, keeps the models and turns AI off", () => {
    const decision = changeAiSettings(allSaved, input({ removeKey: true }), undefined, {});

    expect(decision).toMatchObject({
      ok: true,
      state: { key: undefined, chatModel: allSaved.chatModel, embeddingModel: allSaved.embeddingModel },
      events: [{ changedParts: ["key-removed"], keyLastFour: undefined, aiOn: false }],
    });
  });

  it("records nothing when a key that is not there is removed", () => {
    expect(changeAiSettings(nothingSaved, input({ removeKey: true }), undefined, {})).toEqual({
      ok: true,
      state: nothingSaved,
      events: [],
    });
  });
});

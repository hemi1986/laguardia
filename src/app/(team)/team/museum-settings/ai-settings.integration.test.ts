import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import { aiSettingsForm, changeAiSettingsCommand, type AiDependencies } from "@/modules/ai-assistance";
import {
  geminiEmbedding,
  geminiFlash,
  memoryAi,
  type MemoryAiSettings,
  type MemoryModel,
} from "@/modules/ai-assistance/ai-seam.test-support";
import {
  aiSettingsJournal,
  storedAiSettingsRow,
  withoutAiSettings,
} from "@/modules/ai-assistance/ai-settings.test-support";
import { fixedClock } from "@/platform/clock";
import type { Actor } from "@/platform/command";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aiSettingsFormDefinition, removeAiKeyDefinition } from "./ai-settings-form-input";
import { AiSettingsFormContent } from "./ai-settings-form";
import { aiLanding, loadAiSettings } from "./ai-settings-data";
import { AiSettingsSection, aiSettingsFormProps } from "./ai-settings-section";

/**
 * The form „KI“ on „Einstellungen“ (ST-104): its fields and input functions run through the Server Action runner as the
 * signed-in team member, CMD-ChangeAiSettings asks the in-memory AI seam instead of OpenRouter (seam decided by the
 * user, ST-104 test plan), and the page shows what is stored. In a database of its own: the AI settings exist once,
 * and every test starts from "nothing saved".
 */
const isolated = isolatedTestDatabase("ai_settings_page");
let db: NodePgDatabase;
const clock = fixedClock("2026-11-01T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const helga = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const environmentKey = randomBytes(32);

const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
const OTHER_KEY = "sk-or-v1-fedcba9876543210fedcba9876543210c3d4";
const REFUSED_KEY = "sk-or-v1-refused000000000000000000000000dead";

const textChat: MemoryModel = { ...geminiFlash, id: "text/chat", name: "Text Chat", readsTextAndImages: false };
const textEmbedding: MemoryModel = {
  ...geminiEmbedding,
  id: "text/embedding",
  name: "Text Embedding",
  readsTextAndImages: false,
};
const smallEmbedding: MemoryModel = {
  ...geminiEmbedding,
  id: "small/embedding",
  name: "Small Embedding",
  embeddingSize: 768,
};

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, helga, "Helga");
});

afterAll(() => isolated.close());

/** How many entries the AI settings' journal had when the test began – a rejection adds none. */
let journalBefore = 0;

beforeEach(async () => {
  await withoutAiSettings(db);
  journalBefore = (await aiSettingsJournal(db)).length;
});

/** OpenRouter as the test needs it – by default it offers Gemini 2.5 Flash and Gemini Embedding 2 and accepts KEY. */
function openRouterWith(settings: MemoryAiSettings = {}): AiDependencies & { ai: ReturnType<typeof memoryAi> } {
  return {
    ai: memoryAi({ acceptedKeys: [KEY, OTHER_KEY], ...settings }),
    encryptionKey: () => environmentKey,
  };
}

/** The form „KI“ as the actor sends it; `landed` names where each successful save went. */
function aiFormOf(actor: Actor, dependencies = openRouterWith()) {
  const landed: string[] = [];
  const run = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID });
  const command = changeAiSettingsCommand(dependencies);
  return {
    save: run(command, { ...aiSettingsFormDefinition, onSuccess: async () => void landed.push(aiLanding("saved")) }),
    remove: run(command, {
      ...removeAiKeyDefinition,
      onSuccess: async () => void landed.push(aiLanding("key-removed")),
    }),
    landed,
  };
}

/** The form as the page shows it now, filled in – the version the page loaded unless another is given. */
async function filledIn(
  fields: { key?: string; chatModel?: string; embeddingModel?: string },
  { version, dependencies = openRouterWith() }: { version?: number; dependencies?: AiDependencies } = {},
) {
  const now = await aiSettingsForm(db, dependencies);
  return post({
    version: String(version ?? now.version),
    keyOffered: "1",
    ...(fields.key !== undefined ? { key: fields.key } : {}),
    ...(fields.chatModel !== undefined ? { chatModel: fields.chatModel } : {}),
    ...(fields.embeddingModel !== undefined ? { embeddingModel: fields.embeddingModel } : {}),
  });
}

/** The section „KI“ the technician lands on. */
async function section(address = "/team/museum-settings", dependencies = openRouterWith()) {
  const params = Object.fromEntries(new URL(address, "http://localhost").searchParams);
  return renderToStaticMarkup(createElement(AiSettingsSection, await loadAiSettings(db, params, { dependencies, viewer: tom.teamMemberId })));
}

/** The form „KI“ after a rejection: the page as it is now, and what the action state kept. */
async function formAfter(
  state: Awaited<ReturnType<ReturnType<typeof aiFormOf>["save"]>>,
  dependencies = openRouterWith(),
) {
  const props = aiSettingsFormProps(await aiSettingsForm(db, dependencies));
  return renderToStaticMarkup(createElement(AiSettingsFormContent, { ...props, state }));
}

const field = (html: string, name: string) =>
  html.match(new RegExp(`<(input|select)[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
const selectedOf = (html: string, name: string) =>
  html
    .match(new RegExp(`<select[^>]*name="${name}"[^>]*>(.*?)</select>`))?.[1]
    ?.match(/<option[^>]*selected=""[^>]*value="([^"]*)"|<option[^>]*value="([^"]*)"[^>]*selected=""/)
    ?.slice(1)
    .find(Boolean);
const optionOf = (html: string, name: string, value: string) =>
  html.match(
    new RegExp(`<select[^>]*name="${name}"[^>]*>.*?(<option[^>]*value="${value}"[^>]*>[^<]*</option>)`),
  )?.[1] ?? "";
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the form „KI“", () => {
  it("ST-104: With nothing saved AI is off, and a missing part can still be added", async () => {
    let html = await section();
    expect(textOf(html)).toContain("KI ist aus. Es fehlen: API-Schlüssel, Chat-Modell, Embedding-Modell.");
    expect(field(html, "key")).toContain('type="password"');
    expect(html).not.toContain("Gespeicherter Schlüssel");

    const { save } = aiFormOf(tom);
    expect(await save(null, await filledIn({ key: KEY }))).toBeNull();

    html = await section(aiLanding("saved"));
    expect(textOf(html)).toContain("KI gespeichert.");
    expect(textOf(html)).toContain("KI ist aus. Es fehlen: Chat-Modell, Embedding-Modell.");
    expect(textOf(html)).toContain("Gespeicherter Schlüssel: …a1b2");
    expect(field(html, "key")).toBe("");
    // ST-104's stopgap ended with ST-110: the saved key is offered „Ersetzen“ (ST-104 Notes, "until ST-110").
    expect(html).toContain("Ersetzen");
    expect(field(html, "chatModel")).toContain("<select");
    expect(field(html, "embeddingModel")).toContain("<select");

    expect(
      await save(null, await filledIn({ chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id })),
    ).toBeNull();

    html = await section(aiLanding("saved"));
    expect(textOf(html)).toContain("KI gespeichert. KI ist an.");
    expect(textOf(html)).toContain("Gespeicherter Schlüssel: …a1b2");
  });

  it("ST-104: A technician turns AI on with a key and two models from OpenRouter's list", async () => {
    let html = await section();
    expect(textOf(optionOf(html, "chatModel", geminiFlash.id))).toContain(
      "Gemini 2.5 Flash · 1.048.576 Token · 0,30 $ / 2,50 $ pro Mio. Token (Eingabe / Ausgabe)",
    );
    expect(textOf(optionOf(html, "embeddingModel", geminiEmbedding.id))).toContain(
      "Gemini Embedding 2 · 8.192 Token · 0,15 $ pro Mio. Token (Eingabe)",
    );
    const { save, landed } = aiFormOf(tom);

    expect(
      await save(null, await filledIn({ key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id })),
    ).toBeNull();

    expect(landed).toEqual([aiLanding("saved")]);
    html = await section(aiLanding("saved"));
    expect(textOf(html)).toContain("KI ist an.");
    expect(textOf(html)).toContain("Chat-Modell: Gemini 2.5 Flash");
    expect(textOf(html)).toContain("Embedding-Modell: Gemini Embedding 2");
    expect(textOf(html)).toContain("Gespeicherter Schlüssel: …a1b2");
    expect(field(html, "key")).toBe("");
    expect(textOf(html)).toContain("Lege bei OpenRouter ein Ausgabenlimit für den Schlüssel fest");
    expect(textOf(html)).toContain("erwähne das im Datenschutzhinweis (Rechtstexte)");
    expect(html).not.toContain(KEY);
    expect(html).not.toContain(KEY.slice(0, -4));

    const [changed] = (await aiSettingsJournal(db)).slice(-1);
    expect(changed).toMatchObject({
      type: "EVT-AiSettingsChanged",
      actor: tom,
      data: {
        changedParts: ["key-saved", "chat-model", "embedding-model"],
        keyLastFour: "a1b2",
        chatModel: geminiFlash.id,
        embeddingModel: geminiEmbedding.id,
        aiOn: true,
      },
    });
    const journal = JSON.stringify(await aiSettingsJournal(db));
    expect(journal).not.toContain(KEY.slice(0, -4));
    expect(JSON.stringify(await storedAiSettingsRow(db))).not.toContain(KEY.slice(0, -4));
  });

  it("ST-104: A key OpenRouter refuses is rejected", async () => {
    const { save, landed } = aiFormOf(tom);

    const state = await save(
      null,
      await filledIn({ key: REFUSED_KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id }),
    );

    expect(state).toMatchObject({ error: "ai-key-refused" });
    expect(landed).toEqual([]);
    const html = await formAfter(state);
    expect(field(html, "key")).toContain('aria-invalid="true"');
    expect(field(html, "key")).not.toContain("value=");
    expect(html).not.toContain(REFUSED_KEY);
    expect(textOf(html)).toContain(
      "OpenRouter hat den Schlüssel abgelehnt. Bitte den Schlüssel prüfen und erneut eingeben.",
    );
    expect(selectedOf(html, "chatModel")).toBe(geminiFlash.id);
    expect(selectedOf(html, "embeddingModel")).toBe(geminiEmbedding.id);
    const now = await aiSettingsForm(db, openRouterWith());
    expect(now).toMatchObject({ aiOn: false, keyLastFour: undefined, chatModel: undefined, embeddingModel: undefined });
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
  });

  it("ST-104: Models that do not fit are offered in the list but cannot be chosen", async () => {
    const dependencies = openRouterWith({
      models: [geminiFlash, textChat, geminiEmbedding, textEmbedding, smallEmbedding],
    });

    const html = await section(undefined, dependencies);

    for (const [name, value] of [
      ["chatModel", "text/chat"],
      ["embeddingModel", "text/embedding"],
    ]) {
      expect(optionOf(html, name, value)).toContain('disabled=""');
      expect(textOf(optionOf(html, name, value))).toMatch(/· passt nicht\s*$/);
    }
    for (const [name, value] of [
      ["chatModel", geminiFlash.id],
      ["embeddingModel", geminiEmbedding.id],
      ["embeddingModel", "small/embedding"],
    ]) {
      expect(optionOf(html, name, value)).not.toBe("");
      expect(optionOf(html, name, value)).not.toContain("disabled");
      expect(optionOf(html, name, value)).not.toContain("passt nicht");
    }

    // Sent anyway – a forged form – it is rejected at the chat model and saves nothing.
    const { save } = aiFormOf(tom, dependencies);
    const forged = await save(
      null,
      await filledIn({ key: KEY, chatModel: "text/chat", embeddingModel: geminiEmbedding.id }, { dependencies }),
    );
    expect(forged).toMatchObject({ error: "chat-model-reads-no-images" });
    expect(field(await formAfter(forged, dependencies), "chatModel")).toContain('aria-invalid="true"');

    // „Small Embedding“ can be chosen; it does not fit the AI index, which shows when it is saved (user, 2026-11-01).
    const small = await save(
      null,
      await filledIn({ key: KEY, chatModel: geminiFlash.id, embeddingModel: "small/embedding" }, { dependencies }),
    );
    expect(small).toMatchObject({ error: "embedding-model-wrong-size" });
    const html2 = await formAfter(small, dependencies);
    expect(field(html2, "embeddingModel")).toContain('aria-invalid="true"');
    expect(textOf(html2)).toContain(
      "Dieses Embedding-Modell passt nicht zur KI-Erfassung (es liefert keine 1536 Werte). Bitte ein anderes wählen.",
    );
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
  });

  it("ST-104: Without OpenRouter's model list a typed model that does not fit is rejected", async () => {
    const dependencies = openRouterWith({
      listsUnavailable: true,
      models: [geminiFlash, textChat, geminiEmbedding, textEmbedding, smallEmbedding],
    });
    const readsNoImages = "Dieses Modell liest keine Bilder. Bitte ein Modell wählen, das Text und Bilder liest.";
    const examples = [
      { typed: { chatModel: "text/chat", embeddingModel: geminiEmbedding.id }, at: "chatModel", reason: readsNoImages },
      { typed: { chatModel: geminiFlash.id, embeddingModel: "text/embedding" }, at: "embeddingModel", reason: readsNoImages },
      {
        typed: { chatModel: geminiFlash.id, embeddingModel: "small/embedding" },
        at: "embeddingModel",
        reason:
          "Dieses Embedding-Modell passt nicht zur KI-Erfassung (es liefert keine 1536 Werte). Bitte ein anderes wählen.",
      },
    ];

    for (const { typed, at, reason } of examples) {
      await withoutAiSettings(db);
      const state = await aiFormOf(tom, dependencies).save(null, await filledIn({ key: KEY, ...typed }, { dependencies }));

      expect(state, typed.embeddingModel).not.toBeNull();
      const html = await formAfter(state, dependencies);
      expect(field(html, at)).toContain('aria-invalid="true"');
      expect(textOf(html)).toContain(reason);
      expect(field(html, "chatModel")).toContain(`value="${typed.chatModel}"`);
      expect(field(html, "embeddingModel")).toContain(`value="${typed.embeddingModel}"`);
      expect(field(html, "key")).not.toContain("value=");
      expect(await aiSettingsForm(db, dependencies)).toMatchObject({ aiOn: false, keyLastFour: undefined });
    }
  });

  it("ST-104: Without OpenRouter's model list the models are typed by hand", async () => {
    const dependencies = openRouterWith({ listsUnavailable: true });

    let html = await section(undefined, dependencies);
    expect(textOf(html)).toContain(
      "Die Modellliste von OpenRouter ließ sich nicht laden. Bitte die Modell-IDs eingeben, z. B. google/gemini-embedding-2.",
    );
    expect(field(html, "chatModel")).toMatch(/^<input/);
    expect(field(html, "embeddingModel")).toMatch(/^<input/);

    const { save } = aiFormOf(tom, dependencies);
    expect(
      await save(
        null,
        await filledIn(
          { key: KEY, chatModel: "google/gemini-2.5-flash", embeddingModel: "google/gemini-embedding-2" },
          { dependencies },
        ),
      ),
    ).toBeNull();

    html = await section(aiLanding("saved"), dependencies);
    expect(textOf(html)).toContain("KI ist an.");
  });

  it("ST-104: Removing the key turns AI off", async () => {
    const { save, remove, landed } = aiFormOf(tom);
    await save(null, await filledIn({ key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id }));
    const { version } = await aiSettingsForm(db, openRouterWith());

    expect(await remove(null, post({ version: String(version) }))).toBeNull();

    expect(landed.at(-1)).toBe(aiLanding("key-removed"));
    const html = await section(aiLanding("key-removed"));
    expect(textOf(html)).toContain("Schlüssel entfernt. KI ist aus.");
    expect(textOf(html)).toContain("KI ist aus. Es fehlen: API-Schlüssel.");
    expect(textOf(html)).toContain("Chat-Modell: Gemini 2.5 Flash");
    expect(textOf(html)).toContain("Embedding-Modell: Gemini Embedding 2");
    expect(field(html, "key")).toContain('type="password"');
    const [removed] = (await aiSettingsJournal(db)).slice(-1);
    expect(removed).toMatchObject({
      type: "EVT-AiSettingsChanged",
      actor: tom,
      data: { changedParts: ["key-removed"], keyLastFour: null, aiOn: false },
    });
  });

  it("ST-104: AI settings changed by someone else meanwhile are not overwritten", async () => {
    const dependencies = openRouterWith({ models: [geminiFlash, textChat, geminiEmbedding, smallEmbedding] });
    const { version: seen } = await aiSettingsForm(db, dependencies);
    await aiFormOf(eva, dependencies).save(
      null,
      await filledIn(
        { key: OTHER_KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id },
        { dependencies },
      ),
    );
    const otherModel = { ...geminiFlash, id: "other/chat", name: "Other Chat" };
    const withOther = openRouterWith({ models: [geminiFlash, otherModel, geminiEmbedding, smallEmbedding] });

    const state = await aiFormOf(tom, withOther).save(
      null,
      await filledIn(
        { key: KEY, chatModel: "other/chat", embeddingModel: geminiEmbedding.id },
        { version: seen, dependencies: withOther },
      ),
    );

    expect(state).toMatchObject({ error: "version-conflict" });
    const html = await formAfter(state, withOther);
    expect(textOf(html)).toContain(
      "Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.",
    );
    expect(selectedOf(html, "chatModel")).toBe("other/chat");
    expect(selectedOf(html, "embeddingModel")).toBe(geminiEmbedding.id);
    expect(field(html, "key")).not.toContain("value=");
    expect(await aiSettingsForm(db, withOther)).toMatchObject({
      aiOn: true,
      keyLastFour: "c3d4",
      chatModel: { id: geminiFlash.id },
      embeddingModel: { id: geminiEmbedding.id },
    });
  });

  it("refuses a helper's form „KI“ and „Entfernen“ – nothing changes", async () => {
    const { save, remove } = aiFormOf(helga);

    expect(
      await save(null, await filledIn({ key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id })),
    ).toMatchObject({ error: "not-authorized" });
    expect(await remove(null, post({ version: "0" }))).toMatchObject({ error: "not-authorized" });

    expect(await aiSettingsForm(db, openRouterWith())).toMatchObject({ aiOn: false, keyLastFour: undefined });
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
  });

  it("asks for the key again when the saved one cannot be decrypted with this environment's key", async () => {
    await aiFormOf(tom).save(
      null,
      await filledIn({ key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id }),
    );
    const anotherEnvironment = { ...openRouterWith(), encryptionKey: () => randomBytes(32) };

    const html = await section(undefined, anotherEnvironment);

    expect(textOf(html)).toContain("KI ist aus. Es fehlen: API-Schlüssel.");
    expect(html).not.toContain("…a1b2");
    expect(field(html, "key")).toContain('type="password"');
  });

  it("rejects an embedding model without a key to check it, and saves the chat model alone", async () => {
    const { save } = aiFormOf(tom);

    const state = await save(null, await filledIn({ embeddingModel: geminiEmbedding.id }));
    expect(state).toMatchObject({ error: "embedding-model-needs-key" });
    expect(textOf(await formAfter(state))).toContain(
      "Das Embedding-Modell lässt sich nur mit dem API-Schlüssel prüfen. Bitte den Schlüssel mit eingeben.",
    );

    expect(await save(null, await filledIn({ chatModel: geminiFlash.id }))).toBeNull();
    expect(await aiSettingsForm(db, openRouterWith())).toMatchObject({
      aiOn: false,
      missing: ["key", "embedding-model"],
    });
  });

  it("says why a save is rejected also when the saved key causes it, whose field is not shown", async () => {
    await aiFormOf(tom).save(null, await filledIn({ key: KEY, chatModel: geminiFlash.id }));
    // The key is revoked at OpenRouter meanwhile: the test embedding with the saved key is refused.
    const revoked = openRouterWith({ acceptedKeys: [] });

    const state = await aiFormOf(tom, revoked).save(
      null,
      post({ version: String((await aiSettingsForm(db, revoked)).version), embeddingModel: geminiEmbedding.id }),
    );

    expect(state).toMatchObject({ error: "ai-key-refused" });
    const html = await formAfter(state, revoked);
    expect(field(html, "key")).toBe("");
    expect(textOf(html)).toContain("OpenRouter hat den Schlüssel abgelehnt.");
  });

  it("says when OpenRouter cannot be reached to check the key, and saves nothing", async () => {
    const dependencies = openRouterWith({ unreachable: true });
    const state = await aiFormOf(tom, dependencies).save(null, await filledIn({ key: KEY }, { dependencies }));

    expect(state).toMatchObject({ error: "openrouter-unreachable" });
    expect(textOf(await formAfter(state, dependencies))).toContain(
      "OpenRouter ist gerade nicht erreichbar. Es wurde nichts gespeichert – bitte später erneut speichern.",
    );
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
  });
});

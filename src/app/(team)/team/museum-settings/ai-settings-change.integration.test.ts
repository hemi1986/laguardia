import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { formRunner } from "@/app/_actions/form-runner";
import {
  aiSettingsForm,
  changeAiSettingsCommand,
  defectAiAssessments,
  type AiDependencies,
} from "@/modules/ai-assistance";
import { aiIndexOf, anIndexedFile } from "@/modules/ai-assistance/ai-index.test-support";
import {
  geminiEmbedding,
  geminiFlash,
  type MemoryAiSettings,
  type MemoryModel,
} from "@/modules/ai-assistance/ai-seam.test-support";
import { aiScenario, SCENARIO_KEY as KEY } from "@/modules/ai-assistance/ai-scenario.test-support";
import { field, labelOf, selectedOf, textOf } from "@/test-support/html";
import {
  aiSettingsJournal,
  storedAiSettingsRow,
  withoutAiSettings,
} from "@/modules/ai-assistance/ai-settings.test-support";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  aiSaveLanding,
  aiSettingsFormDefinition,
  confirmEmbeddingModelDefinition,
  embeddingModelWarning,
} from "./ai-settings-form-input";
import { AiSettingsFormContent } from "./ai-settings-form";
import { aiLanding, loadAiSettings, REPLACE_KEY_ADDRESS } from "./ai-settings-data";
import { AiSettingsSection, aiSettingsFormProps } from "./ai-settings-section";
import { loadEmbeddingModelChange } from "./embedding-modell-wechseln/embedding-model-change-data";
import { EmbeddingModelChangeView } from "./embedding-modell-wechseln/embedding-model-change-view";

/**
 * ST-110 on „Einstellungen“: replacing the key, a key that can no longer be read, the warning before the embedding
 * model changes, and a save without a change. The forms run through the Server Action runner as the signed-in
 * technician, CMD-ChangeAiSettings asks the in-memory AI seam (seam catalog, ST-104), and the pages – the section „KI“
 * and the warning – are their data functions rendered by their views. In a database of its own: the AI settings exist
 * once.
 */
const isolated = isolatedTestDatabase("ai_settings_change_page");
let db: NodePgDatabase;
const clock = fixedClock("2026-11-04T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const OTHER_KEY = "sk-or-v1-fedcba9876543210fedcba9876543210c3d4";
const REFUSED_KEY = "sk-or-v1-refused000000000000000000000000dead";

const otherEmbedding: MemoryModel = {
  ...geminiEmbedding,
  id: "other/embedding",
  name: "Other Embedding",
  pricePerMillion: { input: 0.2 },
};

let machineId: string;
/** The files this test attached and indexed – what "nothing is indexed again" looks at. */
let attached: string[] = [];
const aiIndexNow = () => aiIndexOf(db, attached);

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Eight Ball", manufacturer: "Bally", machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!model.ok) throw new Error(model.error);
  const machine = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: model.result.machineModelId,
      museumNumber: undefined,
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!machine.ok) throw new Error(machine.error);
  machineId = machine.result.machineId;
});

afterAll(() => isolated.close());

let journalBefore = 0;

beforeEach(async () => {
  await db.execute("DELETE FROM ai_index_entry");
  await db.execute("DELETE FROM file");
  attached = [];
  await withoutAiSettings(db);
  await turnAiOn();
  journalBefore = (await aiSettingsJournal(db)).length;
});

const scenario = aiScenario({ db: () => db, clock, technician: tom });

function openRouterWith(settings: MemoryAiSettings = {}): AiDependencies {
  return scenario.ai(
    scenario.openRouter({
      acceptedKeys: [KEY, OTHER_KEY],
      models: [geminiFlash, geminiEmbedding, otherEmbedding],
      ...settings,
    }),
  );
}

/** AI on with the key ending in "a1b2", Gemini 2.5 Flash and Gemini Embedding 2. */
const turnAiOn = () => scenario.turnAiOn({ with: openRouterWith() });

/** The form „KI“ and the warning's confirmation as Tom sends them; `landed` names where each save went. */
function formsOf(actor: Actor, dependencies = openRouterWith()) {
  const landed: string[] = [];
  const run = formRunner({ currentPerson: async () => actor, db, clock, newId: randomUUID });
  const command = changeAiSettingsCommand(dependencies);
  return {
    /** The form „KI“, landing as its action does (`aiSaveLanding`). */
    save: async (formData: FormData) =>
      run(command, {
        ...aiSettingsFormDefinition,
        onSuccess: async () => void landed.push(aiLanding(aiSaveLanding(formData).landing)),
      })(null, formData),
    confirm: run(command, {
      ...confirmEmbeddingModelDefinition,
      onSuccess: async () => void landed.push(aiLanding("saved")),
    }),
    landed,
  };
}

/** The form „KI“ as the page shows it, filled in – both models as the page preselects them unless changed. */
async function filledIn(fields: { key?: string; keyOffered?: string; chatModel?: string; embeddingModel?: string }) {
  const now = await aiSettingsForm(db, openRouterWith());
  return post({
    version: String(now.version),
    ...(fields.keyOffered !== undefined ? { keyOffered: fields.keyOffered } : {}),
    key: fields.key ?? "",
    chatModel: fields.chatModel ?? now.chatModel?.id ?? "",
    embeddingModel: fields.embeddingModel ?? now.embeddingModel?.id ?? "",
  });
}

async function section(address = "/team/museum-settings", dependencies = openRouterWith()) {
  const params = Object.fromEntries(new URL(address, "http://localhost").searchParams);
  return renderToStaticMarkup(
    createElement(AiSettingsSection, await loadAiSettings(db, params, { dependencies, viewer: tom.teamMemberId })),
  );
}

async function formAfter(
  state: Awaited<ReturnType<ReturnType<typeof formsOf>["save"]>>,
  address = "/team/museum-settings",
) {
  const params = Object.fromEntries(new URL(address, "http://localhost").searchParams);
  const data = await loadAiSettings(db, params, { dependencies: openRouterWith(), viewer: tom.teamMemberId });
  const props = aiSettingsFormProps(data.form, data);
  return renderToStaticMarkup(createElement(AiSettingsFormContent, { ...props, state }));
}

async function warning(address: string, tokensPerPageOrImage = 2500) {
  const params = Object.fromEntries(new URL(address, "http://localhost").searchParams);
  const data = await loadEmbeddingModelChange(db, params, { dependencies: openRouterWith(), tokensPerPageOrImage });
  return { data, html: renderToStaticMarkup(createElement(EmbeddingModelChangeView, data)) };
}

async function attachedAndIndexed(title: string, pages: number): Promise<string> {
  const fileId = await scenario.attachFile(machineId, {
    title,
    bytes: new Uint8Array(1000),
    contentType: "application/pdf",
  });
  await anIndexedFile(db, clock, fileId, { embeddingModel: geminiEmbedding.id, pages });
  attached.push(fileId);
  return fileId;
}

describe("replacing the key", () => {
  it("ST-110: A technician replaces the key", async () => {
    const manual = await attachedAndIndexed("Eight Ball Manual", 3);
    const indexedBefore = await aiIndexNow();
    let html = await section();
    expect(html).toContain(`href="${REPLACE_KEY_ADDRESS.replaceAll("&", "&amp;")}"`);
    expect(textOf(html)).toContain("Ersetzen");
    expect(field(html, "key")).toBe("");

    html = await section(REPLACE_KEY_ADDRESS);
    expect(labelOf(html, "key")).toBe("Neuer API-Schlüssel");
    expect(field(html, "key")).toContain('type="password"');
    const { save, landed } = formsOf(tom);

    expect(await save(await filledIn({ key: OTHER_KEY, keyOffered: "replace" }))).toBeNull();

    expect(landed).toEqual([aiLanding("key-replaced")]);
    html = await section(aiLanding("key-replaced"));
    expect(textOf(html)).toContain("Schlüssel ersetzt.");
    expect(textOf(html)).toContain("Gespeicherter Schlüssel: …c3d4");
    expect(textOf(html)).toContain("KI ist an.");
    expect(html).not.toContain("a1b2");
    for (const key of [KEY, OTHER_KEY]) expect(html).not.toContain(key.slice(0, -4));
    // No file is indexed again: the entry stays the one of Gemini Embedding 2, and nothing waits.
    expect(await aiIndexNow()).toEqual(indexedBefore);
    expect(indexedBefore[manual]).toEqual({ embeddingModel: geminiEmbedding.id, indexings: 1 });
    expect(textOf(html)).toContain("1 Datei für die KI erfasst · 0 warten auf KI-Erfassung");
    const journal = await aiSettingsJournal(db);
    expect(journal.slice(journalBefore)).toMatchObject([
      {
        type: "EVT-AiSettingsChanged",
        actor: tom,
        data: { changedParts: ["key-saved"], keyLastFour: "c3d4", aiOn: true },
      },
    ]);
    for (const key of [KEY, OTHER_KEY]) {
      expect(JSON.stringify(journal)).not.toContain(key.slice(0, -4));
      expect(JSON.stringify(await storedAiSettingsRow(db))).not.toContain(key.slice(0, -4));
    }
  });

  it("ST-110: A replacement key OpenRouter refuses keeps the saved key", async () => {
    const { save, landed } = formsOf(tom);

    const state = await save(await filledIn({ key: REFUSED_KEY, keyOffered: "replace" }));

    expect(state).toMatchObject({ error: "ai-key-refused" });
    expect(landed).toEqual([]);
    // The action re-renders the page it was posted from – the one after „Ersetzen“.
    const html = await formAfter(state, REPLACE_KEY_ADDRESS);
    expect(labelOf(html, "key")).toBe("Neuer API-Schlüssel");
    expect(field(html, "key")).toContain('aria-invalid="true"');
    expect(field(html, "key")).not.toContain("value=");
    expect(html).not.toContain(REFUSED_KEY);
    expect(textOf(html)).toContain(
      "OpenRouter hat den Schlüssel abgelehnt. Bitte den Schlüssel prüfen und erneut eingeben.",
    );
    expect(await aiSettingsForm(db, openRouterWith())).toMatchObject({ aiOn: true, keyLastFour: "a1b2" });
    expect(textOf(await section())).toContain("Gespeicherter Schlüssel: …a1b2");
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
  });

  it("ST-110: A saved key that can no longer be read turns AI off", async () => {
    const reported = await executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId,
        description: "Left flipper weak",
        triage: {
          outcome: "defect-recorded",
          title: "Left flipper weak",
          priority: undefined,
          suitableForHelpers: false,
          machineStatus: undefined,
          machineVersion: undefined,
        },
      },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
    const sameEnvironment = openRouterWith();
    const viewer = { teamMemberId: tom.teamMemberId, role: "technician" } as const;
    expect(
      await defectAiAssessments(db, { defectId: reported.result.defectId, viewer, dependencies: sameEnvironment }),
    ).toMatchObject({ mayRequest: true });
    // The environment's encryption key has changed since the key was saved.
    const changedEnvironment = { ...openRouterWith(), encryptionKey: () => randomBytes(32) };

    const html = await section(undefined, changedEnvironment);

    expect(textOf(html)).toContain("KI ist aus. Es fehlen: API-Schlüssel.");
    expect(textOf(html)).toContain(
      "Der gespeicherte Schlüssel lässt sich nicht mehr lesen. Bitte den Schlüssel erneut eingeben.",
    );
    expect(labelOf(html, "key")).toBe("OpenRouter-API-Schlüssel");
    expect(field(html, "key")).toContain('type="password"');
    expect(html).not.toContain("…a1b2");
    expect(html).not.toContain("Ersetzen");
    expect(
      await defectAiAssessments(db, { defectId: reported.result.defectId, viewer, dependencies: changedEnvironment }),
    ).toMatchObject({ mayRequest: false, shown: false });
  });
});

describe("changing the embedding model", () => {
  /** 40 files with 1.200 pages and images, indexed with Gemini Embedding 2. */
  async function fortyFiles() {
    for (let number = 1; number <= 40; number++) await attachedAndIndexed(`Manual ${number}`, 30);
  }

  it("ST-110: Changing the embedding model warns what indexing again will cost", async () => {
    await fortyFiles();
    const indexedBefore = await aiIndexNow();
    const { save, landed } = formsOf(tom);
    const posted = await filledIn({ embeddingModel: otherEmbedding.id });

    const state = await save(posted);

    expect(landed).toEqual([]);
    const address = embeddingModelWarning(state, aiSaveLanding(posted).keyTyped);
    expect(address).toBeDefined();
    const { html } = await warning(address!);
    expect(textOf(html)).toContain(
      "Embedding-Modell wechseln? Alle 40 Dateien (1.200 Seiten und Bilder) werden neu für die KI erfasst. Geschätzte Kosten: etwa 0,60 $. Bis dahin findet die KI nur die schon neu erfassten Dateien.",
    );
    // It names what the confirmation saves – only the embedding model, the chat model was not changed.
    expect(textOf(html)).toContain("Embedding-Modell: Other Embedding");
    expect(textOf(html)).not.toContain("Chat-Modell:");
    expect(html).toContain(">Embedding-Modell wechseln</button>");
    expect(textOf(html)).toContain("Zurück");
    expect(html).not.toContain("Endgültig");
    // No red (G30): nothing is lost.
    expect(html).not.toMatch(/\bbg-destructive/);
    expect(html).not.toContain(KEY.slice(0, -4));
    expect(address).not.toContain("key");
    expect((await aiSettingsForm(db, openRouterWith())).embeddingModel?.id).toBe(geminiEmbedding.id);
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
    expect(await aiIndexNow()).toEqual(indexedBefore);
  });

  it("ST-110: Going back from the warning changes nothing", async () => {
    await attachedAndIndexed("Eight Ball Manual", 3);
    const indexedBefore = await aiIndexNow();
    const posted = await filledIn({ embeddingModel: otherEmbedding.id });
    const address = embeddingModelWarning(await formsOf(tom).save(posted), false);
    const { data, html } = await warning(address!);
    expect(html).toContain(`href="${data.back.replaceAll("&", "&amp;")}"`);

    // „Zurück“ is a link: nothing is posted, the form „KI“ opens with the chosen model.
    const form = await section(data.back);

    expect((await aiSettingsForm(db, openRouterWith())).embeddingModel?.id).toBe(geminiEmbedding.id);
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
    expect(await aiIndexNow()).toEqual(indexedBefore);
    expect(textOf(form)).toContain("Embedding-Modell: Gemini Embedding 2");
    expect(selectedOf(form, "embeddingModel")).toBe(otherEmbedding.id);
    expect(selectedOf(form, "chatModel")).toBe(geminiFlash.id);
  });

  it("asks to save a new key first when it is typed together with another embedding model", async () => {
    const posted = await filledIn({ key: OTHER_KEY, keyOffered: "replace", embeddingModel: otherEmbedding.id });

    const state = await formsOf(tom).save(posted);

    expect(state).toMatchObject({ error: "embedding-model-change-unconfirmed" });
    expect(embeddingModelWarning(state, aiSaveLanding(posted).keyTyped)).toBeUndefined();
    const html = await formAfter(state, REPLACE_KEY_ADDRESS);
    expect(textOf(html)).toContain(
      "Bitte den neuen Schlüssel zuerst allein speichern und danach das Embedding-Modell wechseln.",
    );
    expect(field(html, "key")).toContain('aria-invalid="true"');
    expect(field(html, "key")).not.toContain("value=");
    expect(html).not.toContain(OTHER_KEY.slice(0, -4));
    expect(await aiSettingsForm(db, openRouterWith())).toMatchObject({ keyLastFour: "a1b2" });
  });

  it("changes the embedding model once confirmed, and lands like a save", async () => {
    const posted = await filledIn({ embeddingModel: otherEmbedding.id });
    const address = embeddingModelWarning(await formsOf(tom).save(posted), false);
    const { data } = await warning(address!);
    const { confirm, landed } = formsOf(tom);

    expect(await confirm(null, post(data.posted))).toBeNull();

    expect(landed).toEqual([aiLanding("saved")]);
    expect((await aiSettingsForm(db, openRouterWith())).embeddingModel?.id).toBe(otherEmbedding.id);
    expect((await aiSettingsJournal(db)).slice(journalBefore)).toMatchObject([
      { type: "EVT-AiSettingsChanged", actor: tom, data: { changedParts: ["embedding-model"], aiOn: true } },
    ]);
  });
});

describe("saving without a change", () => {
  it("ST-110: Saving without a change records nothing", async () => {
    await attachedAndIndexed("Eight Ball Manual", 3);
    const indexedBefore = await aiIndexNow();
    let html = await section();
    expect(selectedOf(html, "chatModel")).toBe(geminiFlash.id);
    expect(selectedOf(html, "embeddingModel")).toBe(geminiEmbedding.id);
    const { save, landed } = formsOf(tom);

    expect(await save(await filledIn({}))).toBeNull();

    expect(landed).toEqual([aiLanding("saved")]);
    html = await section(aiLanding("saved"));
    expect(textOf(html)).toContain("KI gespeichert.");
    expect(textOf(html)).toContain("Gespeicherter Schlüssel: …a1b2");
    expect(textOf(html)).toContain("Chat-Modell: Gemini 2.5 Flash");
    expect(textOf(html)).toContain("Embedding-Modell: Gemini Embedding 2");
    expect(selectedOf(html, "chatModel")).toBe(geminiFlash.id);
    expect(selectedOf(html, "embeddingModel")).toBe(geminiEmbedding.id);
    expect(await aiSettingsJournal(db)).toHaveLength(journalBefore);
    expect(await aiIndexNow()).toEqual(indexedBefore);
    expect(textOf(html)).toContain("0 warten auf KI-Erfassung");
  });
});

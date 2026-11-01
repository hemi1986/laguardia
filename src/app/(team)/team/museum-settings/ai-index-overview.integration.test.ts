import { randomBytes, randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { attachFileCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import {
  aiSettingsForm,
  changeAiSettingsCommand,
  fileIndexingWork,
  runAiWork,
  type AiDependencies,
} from "@/modules/ai-assistance";
import { geminiEmbedding, geminiFlash, memoryAi } from "@/modules/ai-assistance/ai-seam.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { executeCommand } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadAiSettings } from "./ai-settings-data";
import { AiSettingsSection } from "./ai-settings-section";

/**
 * ST-109: the overview „KI-Erfassung“ in the form „KI“ on „Einstellungen“, „Erneut versuchen“ on a failed file, and the
 * mark „Für die KI nicht lesbar“ on the machine record. Files are attached through Collection's command and indexed by
 * one run of the background work driven directly (`runAiWork` with the real file kind, the injected clock, in-memory AI
 * and storage – ADR 0015, the seam catalog's run seam); the pages are their data functions rendered by their views. In
 * a database of its own: the AI settings and the AI index are one set.
 */
const isolated = isolatedTestDatabase("ai_index_overview");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-04T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const environmentKey = randomBytes(32);
const KEY = "sk-or-v1-0123456789abcdef0123456789abcdefa1b2";
let eightBall: string;
let storage: MemoryStorage;

afterAll(() => isolated.close());

/**
 * Every test from an empty database: the journal is append-only, and the cost of indexing so far is summed from all of
 * it – a run of another test would count.
 */
beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  clock.set("2026-11-04T10:00:00Z");
  storage = memoryStorage();
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Eight Ball", manufacturer: "Bally", year: "1980", machineCategory: "pinball" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  eightBall = created.result.machineModelId;
});

/** The AI seam – by default it accepts KEY, offers the Gemini models and charges what a test says per embedding. */
function ai(settings: Parameters<typeof memoryAi>[0] = {}): AiDependencies & { ai: ReturnType<typeof memoryAi> } {
  return { ai: memoryAi({ acceptedKeys: [KEY], ...settings }), encryptionKey: () => environmentKey };
}

/** AI turned on through CMD-ChangeAiSettings, the way a technician saves it. */
async function turnAiOn(): Promise<void> {
  const dependencies = ai();
  const { version } = await aiSettingsForm(db, dependencies);
  const saved = await executeCommand(
    changeAiSettingsCommand(dependencies),
    { version, key: KEY, chatModel: geminiFlash.id, embeddingModel: geminiEmbedding.id },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!saved.ok) throw new Error(saved.error);
}

async function aMachine(museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId: eightBall, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

const kinds = {
  text: { contentType: "text/plain", bytes: () => new TextEncoder().encode("The flipper coil and its fuse.") },
  video: { contentType: "video/mp4", bytes: () => new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]) },
} as const;

/** A file attached through CMD-AttachFile to the machine or to its machine model, its content already in the store. */
async function attach(
  machineId: string,
  title: string,
  { kind = "text", to = "machine" }: { kind?: keyof typeof kinds; to?: "machine" | "machine-model" } = {},
): Promise<string> {
  const { contentType, bytes } = kinds[kind];
  const content = bytes();
  const name = `files/${randomUUID()}`;
  await storage.write(name, content, contentType);
  const attached = await executeCommand(
    attachFileCommand,
    { machineId, attachTo: to, title, fileCategory: "other", content: { name, size: content.length, contentType } },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return attached.result.fileId;
}

/** One run of the background work with the real file kind. */
async function run(dependencies: AiDependencies = ai()): Promise<void> {
  await runAiWork({
    db,
    clock,
    budgetSeconds: 250,
    ai: dependencies,
    storage,
    continueWork: async () => {},
    kinds: [fileIndexingWork],
  });
}

/** „Einstellungen“ as a technician opens it – the section „KI“ rendered from its data. */
async function settingsPage(dependencies: AiDependencies = ai()) {
  const data = await loadAiSettings(db, {}, { dependencies });
  return { data, html: renderToStaticMarkup(createElement(AiSettingsSection, data)) };
}

describe("the overview „KI-Erfassung“ (ST-109)", () => {
  it("ST-109: The overview shows how far the AI index got and what it cost", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    for (let number = 1; number <= 12; number++) await attach(machineId, `Notes ${number}`);
    await attach(machineId, "Attract mode.mp4", { kind: "video" });
    await attach(machineId, "Intro.mp4", { kind: "video" });
    // Every text file is one passage, so one embedding request each: 12 × 0.1025 $ = 1.23 $.
    await run(ai({ embeddingCost: 0.1025 }));
    // Attached after the run – no run has reached them yet.
    for (const title of ["Wiring notes", "Coil list", "Fuse list"]) await attach(machineId, title);

    const { html } = await settingsPage();

    expect(html).toContain("KI-Erfassung");
    expect(html).toContain("12 Dateien für die KI erfasst · 3 warten auf KI-Erfassung · 2 für die KI nicht lesbar");
    expect(html).toContain("Kosten der KI-Erfassung bisher: 1,23 $");
  });
});

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addFileCommand,
  createMachineModelCommand,
  fileDetails,
  fileToOpen,
  machineRecord,
  registerMachineCommand,
} from "@/modules/collection";
import { aiIndexStateOfFile, fileIndexingWork, removeFileCommandWithAiIndex } from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { formRunner } from "@/app/_actions/form-runner";
import { executeCommand, journalOf } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineConfirmation } from "../../../../machines/[museumNumber]/machine-confirmation";
import { loadMachineRecord } from "../../../../machines/[museumNumber]/machine-record-data";
import { MachineRecordView } from "../../../../machines/[museumNumber]/machine-record";
import { loadAiSettings } from "../../../../museum-settings/ai-settings-data";
import { AiSettingsSection } from "../../../../museum-settings/ai-settings-section";
import { loadFileDetails } from "../file-details-data";
import { FileDetailsView } from "../file-details-view";
import { removalLanding, removeFileAddress, type FileOrigin } from "../file-origin";
import { loadRemoveFile } from "./remove-file-data";
import { removeFileForm } from "./remove-file-form";
import { RemoveFileView } from "./remove-file-view";

/**
 * ST-121: removing a file on its details page. The question is the page data function of Collection's kept file record
 * rendered by its view; the removal itself runs through the Server Action runner with the real form definition, against
 * real PostgreSQL and the in-memory storage. Files are added through Collection's command.
 */
const isolated = isolatedTestDatabase("remove_file_page");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = steppingClock("2026-11-02T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = () => ({ db, clock, newId: randomUUID });
let medievalMadness: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, ben, "Ben");
  clock.set("2026-11-02T10:00:00Z");
  storage = memoryStorage();
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
    { actor: tom, ...at() },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

async function aMachine(museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, ...at() },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

/** A file added with its attachments at once – the way the tests set them up before CMD-AttachFile. */
async function aFileAttachedTo(
  { machines = [], models = [] }: { machines?: string[]; models?: string[] },
  title: string,
): Promise<string> {
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory: "manual",
      originalFileName: undefined,
      machineIds: machines,
      machineModelIds: models,
      content: { name: `files/${randomUUID()}`, size: 4_200_000, contentType: "application/pdf" },
    },
    { actor: tom, ...at() },
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}

const scenario = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });
const { ai, turnAiOn } = scenario;

/** One run of the background work, indexing the files it finds. */
const run = () => scenario.run({ kinds: [fileIndexingWork], with: ai() });

type Viewer = typeof tom | typeof ben;

/** „Endgültig entfernen“ through the Server Action runner – the form the question page shows. */
async function removeOnDetails(
  fileId: string,
  { version = 0, person = tom }: { version?: number; person?: Viewer } = {},
) {
  const done: string[] = [];
  const action = formRunner({
    currentPerson: async () => person,
    db,
    clock,
    newId: randomUUID,
    storage,
  })(
    removeFileCommandWithAiIndex,
    removeFileForm(fileId, async () => void done.push(fileId)),
  );
  return { done, send: (fields: Record<string, string> = { version: String(version) }) => action(null, post(fields)) };
}

/** The question as a team member opens it – params are the address's query. */
async function question(
  fileId: string,
  { params = {}, person = tom }: { params?: Record<string, string>; person?: Viewer } = {},
) {
  const file = await loadRemoveFile(db, fileId, { params, viewer: { id: person.teamMemberId, role: person.role } });
  if (!file) return { file, html: "" };
  const html = renderToStaticMarkup(
    createElement(RemoveFileView, { file, action: async () => null, refusal: undefined }),
  );
  return { file, html };
}

const viewerOf = (person: Viewer) => ({ id: person.teamMemberId, role: person.role });

/** The machine record as a team member opens it, with the confirmation the address asks for. */
async function machineRecordPage(museumNumber: string, { fileRemoved }: { fileRemoved?: string } = {}) {
  const record = await loadMachineRecord(db, museumNumber, { clock, viewer: viewerOf(tom), ai: ai(), storage });
  const confirmation = record && (await loadMachineConfirmation(db, clock, tom.teamMemberId, record, { fileRemoved }));
  return {
    record,
    html: renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber, confirmation })),
  };
}

/** The file details as a team member opens them – params are the address's query. */
async function detailsPage(fileId: string, { params = {} }: { params?: Record<string, string> } = {}) {
  const file = await loadFileDetails(db, fileId, { params, viewer: viewerOf(tom), ai: ai() });
  if (!file) return "";
  return renderToStaticMarkup(createElement(FileDetailsView, { file, retry: async () => null }));
}

/** „Einstellungen“ as Tom opens it. */
async function settingsPage(params: Record<string, string> = {}) {
  const data = await loadAiSettings(db, params, { dependencies: ai(), viewer: tom.teamMemberId });
  return renderToStaticMarkup(createElement(AiSettingsSection, data));
}

/** The query of an address a page offered – what the person's next request carries. */
const queryOf = (href: string) => Object.fromEntries(new URL(href, "http://museum.test").searchParams);

/** The address of the link with this text in the markup. */
function hrefOf(html: string, linkText: string): string {
  const at = html.indexOf(`>${linkText}</a>`);
  if (at < 0) throw new Error(`No link „${linkText}“`);
  const start = html.lastIndexOf("<a ", at);
  return /href="([^"]+)"/.exec(html.slice(start, at))![1].replaceAll("&amp;", "&");
}

const lines = (html: string) =>
  [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));

describe("the question before removing a file (ST-121)", () => {
  it("ST-121: The question names everything the file disappears from", async () => {
    const machineId = await aMachine("LG-042");
    const manual = await aFileAttachedTo({ machines: [machineId], models: [medievalMadness] }, "MM Operations Manual");

    const { html } = await question(manual, { params: { from: "machine:LG-042" } });

    expect(html).toContain("Datei entfernen · MM Operations Manual</h1>");
    expect(html).toContain("„MM Operations Manual“ entfernen? Die Datei wird endgültig gelöscht.");
    expect(html).toContain("Sie verschwindet bei:");
    expect(lines(html)).toEqual(["LG-042 · Medieval Madness", "Alle Geräte des Modells Medieval Madness"]);
    expect(hrefOf(html, "Zurück")).toBe(`/team/dateien/${manual}/details?from=machine%3ALG-042`);
    expect(await fileDetails(db, manual)).toBeDefined();
  });

  it("ST-121: The question for a file attached to nothing names no list", async () => {
    const notes = await aFileAttachedTo({}, "Wiring notes");

    const { html } = await question(notes);

    expect(html).toContain("„Wiring notes“ entfernen? Die Datei wird endgültig gelöscht.");
    expect(html).not.toContain("Sie verschwindet bei:");
    expect(lines(html)).toEqual([]);
  });

  it("ST-121: A technician removes a file on its details page", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    const wrong = await scenario.attachFile(machineId, {
      title: "MM Manual (wrong edition)",
      bytes: new TextEncoder().encode("The wrong edition's flipper coil."),
      contentType: "text/plain",
      to: "machine-model",
    });
    await run();
    const content = (await fileToOpen(db, wrong))!.content;
    expect(await aiIndexStateOfFile(db, ai(), wrong)).toMatchObject({ state: "indexed" });
    expect((await machineRecord(db, "LG-042"))!.files.map((file) => file.title)).toContain("MM Manual (wrong edition)");

    const removal = await removeOnDetails(wrong);

    expect(await removal.send()).toBeNull();
    expect(removal.done).toEqual([wrong]);
    expect((await machineRecord(db, "LG-042"))!.files.map((file) => file.title)).not.toContain(
      "MM Manual (wrong edition)",
    );
    expect(storage.read(content)).toBeUndefined();
    expect(await fileToOpen(db, wrong)).toBeUndefined();
    const steps = await journalOf(db, { aggregateId: wrong });
    expect(steps.map((step) => step.type)).toContain("EVT-FileLeftAiIndex");
    expect(steps.find((step) => step.type === "EVT-FileRemoved")).toMatchObject({
      aggregate: { type: "AGG-File", id: wrong },
      actor: { kind: "team-member", teamMemberId: tom.teamMemberId },
      occurredAt: clock.now(),
    });
    const { html } = await machineRecordPage("LG-042", { fileRemoved: wrong });
    expect(html).toContain("„MM Manual (wrong edition)“ entfernt.");
  });

  it("ST-121: A removal lands where the person came from", async () => {
    await turnAiOn();
    const machineId = await aMachine("LG-042");
    const video = () => new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]);
    const examples: {
      title: string;
      origin: FileOrigin;
      place: () => Promise<string>;
      link: string;
      landing: (fileId: string) => string;
    }[] = [
      {
        title: "Attract mode.mp4",
        origin: { kind: "machine", museumNumber: "LG-042" },
        place: async () => (await machineRecordPage("LG-042")).html,
        link: "Details",
        landing: (fileId) => `/team/machines/LG-042?fileRemoved=${fileId}`,
      },
      {
        title: "Attract mode (Einstellungen).mp4",
        origin: { kind: "settings" },
        place: () => settingsPage(),
        link: "Attract mode (Einstellungen).mp4",
        landing: (fileId) => `/team/museum-settings?fileRemoved=${fileId}`,
      },
    ];

    for (const example of examples) {
      const fileId = await scenario.attachFile(machineId, {
        title: example.title,
        bytes: video(),
        contentType: "video/mp4",
      });
      await run();
      const detailsAddress = hrefOf(await example.place(), example.link);
      const details = await detailsPage(fileId, { params: queryOf(detailsAddress) });
      const questionAddress = hrefOf(details, "Datei entfernen");
      const question = (await loadRemoveFile(db, fileId, {
        params: queryOf(questionAddress),
        viewer: viewerOf(tom),
      }))!;
      expect(questionAddress).toBe(removeFileAddress(fileId, example.origin));
      expect(question.origin).toEqual(example.origin);
      expect(question.back).toBe(detailsAddress);

      let landed: string | undefined;
      const action = formRunner({ currentPerson: async () => tom, db, clock, newId: randomUUID, storage })(
        removeFileCommandWithAiIndex,
        removeFileForm(fileId, async () => {
          landed = removalLanding(question.origin, fileId);
        }),
      );
      expect(await action(null, post({ version: String(question.version) }))).toBeNull();
      expect(landed).toBe(example.landing(fileId));

      const landing =
        example.origin.kind === "settings"
          ? await settingsPage({ fileRemoved: fileId })
          : (await machineRecordPage("LG-042", { fileRemoved: fileId })).html;
      expect(landing).toContain(`„${example.title}“ entfernt.`);
    }
  });
});

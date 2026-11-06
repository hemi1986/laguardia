import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addFileCommand,
  createMachineModelCommand,
  fileDetails,
  fileRemovedBy,
  fileToOpen,
  machineRecord,
  registerMachineCommand,
  removeFileRefusal,
} from "@/modules/collection";
import { aiIndexStateOfFile, fileIndexingWork, removeFileCommandWithAiIndex } from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { formRunner } from "@/app/_actions/form-runner";
import { executeCommand, journalOf } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { hrefOf, listTexts, queryOf } from "@/test-support/html";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { post } from "@/test-support/forms";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineConfirmation } from "../../../../machines/[museumNumber]/machine-confirmation";
import { loadMachineRecord } from "../../../../machines/[museumNumber]/machine-record-data";
import { MachineRecordView } from "../../../../machines/[museumNumber]/machine-record";
import { loadMachineOverview } from "../../../../machines/machine-overview-data";
import { MachineOverview } from "../../../../machines/machine-overview";
import { loadAiSettings } from "../../../../museum-settings/ai-settings-data";
import { AiSettingsSection } from "../../../../museum-settings/ai-settings-section";
import { loadFileDetails } from "../file-details-data";
import { FileDetailsView } from "../file-details-view";
import { removalLanding, removeFileAddress, type FileOrigin } from "../../../file-navigation";
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
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = () => ({ db, clock, newId: randomUUID });
let medievalMadness: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
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
  const refusal = removeFileRefusal({ removed: file.removed }, { role: person.role });
  const html = renderToStaticMarkup(
    createElement(RemoveFileView, {
      file,
      action: async () => null,
      refusal: refusal && commandErrorText(teamMessages, refusal),
    }),
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
async function detailsPage(
  fileId: string,
  { params = {}, person = tom }: { params?: Record<string, string>; person?: Viewer } = {},
) {
  const file = await loadFileDetails(db, fileId, { params, viewer: viewerOf(person), ai: ai() });
  if (!file) return "";
  return renderToStaticMarkup(
    createElement(FileDetailsView, { file, retry: async () => null, detach: async () => null }),
  );
}

/** „Einstellungen“ as Tom opens it. */
async function settingsPage(params: Record<string, string> = {}) {
  const data = await loadAiSettings(db, params, { dependencies: ai(), viewer: tom.teamMemberId });
  return renderToStaticMarkup(createElement(AiSettingsSection, data));
}

/** The class of the link or button with exactly that text – which component drew it. */
function classOf(html: string, text: string): string {
  const match = new RegExp(`<(?:a|button) [^>]*class="([^"]*)"[^>]*>${text}</(?:a|button)>`).exec(html);
  if (!match) throw new Error(`no link or button „${text}“`);
  return match[1];
}

describe("the question before removing a file (ST-121)", () => {
  it("ST-121: The question names everything the file disappears from", async () => {
    const machineId = await aMachine("LG-042");
    const manual = await aFileAttachedTo({ machines: [machineId], models: [medievalMadness] }, "MM Operations Manual");

    const { html } = await question(manual, { params: { from: "machine:LG-042" } });

    expect(html).toContain("Datei entfernen · MM Operations Manual</h1>");
    expect(html).toContain("„MM Operations Manual“ entfernen? Die Datei wird endgültig gelöscht.");
    expect(html).toContain("Sie verschwindet bei:");
    expect(listTexts(html)).toEqual(["LG-042 · Medieval Madness", "Alle Geräte des Modells Medieval Madness"]);
    expect(hrefOf(html, "Zurück")).toBe(`/team/dateien/${manual}/details?from=machine%3ALG-042`);
    expect((await fileDetails(db, manual))!.attachedTo).toEqual([
      {
        kind: "machine",
        machineId,
        museumNumber: "LG-042",
        machineModelTitle: "Medieval Madness",
        retired: false,
      },
      { kind: "machine-model", machineModelId: medievalMadness, title: "Medieval Madness" },
    ]);
    // Red is only the verb of the question page (G30); the way to it is an ordinary secondary button.
    const details = await detailsPage(manual, { params: { from: "machine:LG-042" } });
    expect(classOf(details, "Datei entfernen")).not.toContain("bg-destructive");
    expect(classOf(html, "Endgültig entfernen")).toContain("bg-destructive");
  });

  it("ST-121: The question for a file attached to nothing names no list", async () => {
    const notes = await aFileAttachedTo({}, "Wiring notes");

    const { html } = await question(notes);

    expect(html).toContain("„Wiring notes“ entfernen? Die Datei wird endgültig gelöscht.");
    expect(html).not.toContain("Sie verschwindet bei:");
    expect(listTexts(html)).toEqual([]);
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
        landing: (fileId) => `/team/museum-settings?fileRemoved=${fileId}#ki`,
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

  it("ST-121: A helper cannot remove a file", async () => {
    const machineId = await aMachine("LG-042");
    const manual = await aFileAttachedTo({ machines: [machineId] }, "MM Operations Manual");

    const details = await detailsPage(manual, { person: ben });
    expect(details).toContain("MM Operations Manual");
    expect(details).not.toContain("Datei entfernen");
    expect(details).not.toContain("/details/entfernen");

    // Sent anyway: the command's own authorization refuses it and nothing changes. The question page itself is
    // technicians-only – its shared `requireTechnician` guard is shown by the browser test.
    const attempt = await removeOnDetails(manual, { person: ben });
    expect(await attempt.send()).toMatchObject({ error: "not-authorized" });
    expect(attempt.done).toEqual([]);
    expect(await fileDetails(db, manual)).toBeDefined();
    expect((await machineRecord(db, "LG-042"))!.files.map((file) => file.title)).toContain("MM Operations Manual");
  });

  it("ST-121: A file already removed cannot be removed again", async () => {
    const machineId = await aMachine("LG-042");
    const old = await aFileAttachedTo({ machines: [machineId] }, "Old manual");
    const seen = (await question(old)).file!;
    expect(seen.removed).toBe(false);
    const removed = await executeCommand(
      removeFileCommandWithAiIndex,
      { fileId: old, version: seen.version },
      { actor: eva, db, clock, newId: randomUUID },
    );
    if (!removed.ok) throw new Error(removed.error);
    const journal = await journalOf(db, { aggregateId: old });

    const attempt = await removeOnDetails(old, { version: seen.version });

    expect(await attempt.send()).toMatchObject({ error: "file-removed" });
    expect(attempt.done).toEqual([]);
    // Nothing else changes: the removal made meanwhile stays the only one.
    expect(await journalOf(db, { aggregateId: old })).toEqual(journal);
    expect(journal.at(-1)).toMatchObject({
      type: "EVT-FileRemoved",
      actor: { teamMemberId: eva.teamMemberId },
    });
    const after = await question(old);
    expect(after.file?.removed).toBe(true);
    expect(after.html).toContain("Diese Datei wurde schon entfernt.");
    expect(after.html).not.toContain("Endgültig entfernen");
    // A removed file's attachments no longer count: the question and its list are gone.
    expect(after.html).not.toContain("Sie verschwindet bei:");
    expect(after.html).not.toContain("„Old manual“ entfernen?");
  });
});

describe("removing a file (ST-038)", () => {
  it("ST-038: Technician removes a file", async () => {
    const machineId = await aMachine("LG-042");
    const wrong = await scenario.attachFile(machineId, {
      title: "MM Manual (wrong edition)",
      bytes: new TextEncoder().encode("The wrong edition's flipper coil."),
      contentType: "text/plain",
      to: "machine-model",
    });
    const content = (await fileToOpen(db, wrong))!.content;
    const removal = await removeOnDetails(wrong);

    expect(await removal.send()).toBeNull();

    expect(removal.done).toEqual([wrong]);
    expect((await machineRecord(db, "LG-042"))!.files.map((file) => file.title)).not.toContain(
      "MM Manual (wrong edition)",
    );
    expect(storage.read(content)).toBeUndefined();
    expect((await journalOf(db, { aggregateId: wrong })).at(-1)).toMatchObject({
      type: "EVT-FileRemoved",
      aggregate: { type: "AGG-File", id: wrong },
      actor: { kind: "team-member", teamMemberId: tom.teamMemberId },
      occurredAt: clock.now(),
    });
  });

  it("keeps the content when the file changed since the question showed it", async () => {
    const machineId = await aMachine("LG-042");
    const flyer = await scenario.attachFile(machineId, {
      title: "MM Flyer (kept)",
      bytes: new TextEncoder().encode("Still the right flyer."),
      contentType: "text/plain",
      to: "machine",
    });
    const content = (await fileToOpen(db, flyer))!.content;

    expect(await (await removeOnDetails(flyer, { version: 4 })).send()).toMatchObject({ error: "version-conflict" });
    expect((await machineRecord(db, "LG-042"))!.files.map((file) => file.title)).toContain("MM Flyer (kept)");
    expect(storage.read(content)).toBeDefined();
  });
});

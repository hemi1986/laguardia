import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addFileCommand,
  attachFileCommand,
  createMachineModelCommand,
  detachFileCommand,
  fileDetails,
  fileToOpen,
  registerMachineCommand,
  removeFileRefusal,
} from "@/modules/collection";
import { aiIndexStateOfFile, fileIndexingWork, removeFileCommandWithAiIndex } from "@/modules/ai-assistance";
import { makesAiWork } from "@/modules/ai-assistance/ai-work-events";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { retireMachineCommand } from "@/modules/repair";
import { formRunner } from "@/app/_actions/form-runner";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineRecord } from "../../../machines/[museumNumber]/machine-record-data";
import { MachineRecordView } from "../../../machines/[museumNumber]/machine-record";
import { loadAttachToFile } from "./anhaengen/attach-to-file-data";
import { attachToFileForm } from "./anhaengen/attach-to-file-form";
import { AttachToFileForm } from "./anhaengen/attach-to-file-form-view";
import { detachFileForm } from "./detach-file-form";
import { attachmentTargetValue } from "./file-attachments";
import { loadFileDetails } from "./file-details-data";
import { FileDetailsView } from "./file-details-view";
import { attachLanding, attachToFileAddress, detachLanding, type FileOrigin } from "./file-origin";
import { loadRemoveFile } from "./entfernen/remove-file-data";
import { removeFileForm } from "./entfernen/remove-file-form";
import { RemoveFileView } from "./entfernen/remove-file-view";

/**
 * ST-115: attaching an existing file to further machines and machine models, and detaching it, from its details page.
 * The pages are their data functions rendered by their views; the forms run through the Server Action runner with the
 * real definitions. Real PostgreSQL, the in-memory store, and one database of its own so the machines can carry the
 * scenario's museum numbers.
 */
const isolated = isolatedTestDatabase("attach_and_detach");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = steppingClock("2026-11-03T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = () => ({ db, clock, newId: randomUUID });
let medievalMadness: string;
let eightBall: string;
let lg042: string;
let lg043: string;
let lg041: string;
let lg050: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, eva, "Eva");
  await anExistingTeamMember(db, ben, "Ben");
  clock.set("2026-11-03T10:00:00Z");
  storage = memoryStorage();
  medievalMadness = await aModel("Medieval Madness");
  eightBall = await aModel("Eight Ball");
  lg042 = await aMachine(medievalMadness, "LG-042");
  lg043 = await aMachine(medievalMadness, "LG-043");
  lg041 = await aMachine(eightBall, "LG-041");
  lg050 = await aMachine(eightBall, "LG-050");
  await retire(lg041);
});

async function aModel(title: string): Promise<string> {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", year: "1997", machineCategory: "pinball", technology: "em" },
    { actor: tom, ...at() },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function aMachine(machineModelId: string, museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, ...at() },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function retire(machineId: string) {
  const retired = await executeCommand(
    retireMachineCommand,
    { machineId, version: 0, reason: "Sold to a collector" },
    { actor: tom, ...at() },
  );
  if (!retired.ok) throw new Error(retired.error);
}

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

type Viewer = Actor & { kind: "team-member" };
const viewerOf = (person: Viewer) => ({ id: person.teamMemberId, role: person.role });
const standInDetach = async () => null;

/** The file details as a team member opens them – params are the address's query. */
async function detailsPage(
  fileId: string,
  {
    params = {},
    person = tom,
    detach = standInDetach,
  }: { params?: Record<string, string>; person?: Viewer; detach?: typeof standInDetach } = {},
) {
  const file = await loadFileDetails(db, fileId, { params, viewer: viewerOf(person), ai: ai() });
  if (!file) return { file, html: "" };
  const html = renderToStaticMarkup(createElement(FileDetailsView, { file, retry: async () => null, detach }));
  return { file, html };
}

/** The form „Anhängen“ as a team member opens it – its data and its view. */
async function attachPage(
  fileId: string,
  { params = {}, person = tom }: { params?: Record<string, string>; person?: Viewer } = {},
) {
  const file = await loadAttachToFile(db, fileId, { params, viewer: viewerOf(person) });
  if (!file) return { file, html: "" };
  const html = renderToStaticMarkup(
    createElement(AttachToFileForm, {
      action: async () => null,
      removed: file.removed,
      machineGroups: file.machineGroups,
      machineModelGroups: file.machineModelGroups,
    }),
  );
  return { file, html };
}

/** The machine record as a team member opens it. */
async function machineRecordPage(museumNumber: string) {
  const record = await loadMachineRecord(db, museumNumber, { clock, viewer: viewerOf(tom), ai: ai(), storage });
  return renderToStaticMarkup(createElement(MachineRecordView, { record, museumNumber }));
}

/** The question before removing a file, as a technician opens it. */
async function removalQuestion(fileId: string) {
  const file = await loadRemoveFile(db, fileId, { params: {}, viewer: viewerOf(tom) });
  if (!file) throw new Error("no question");
  const refusal = removeFileRefusal({ removed: file.removed }, { role: tom.role });
  const html = renderToStaticMarkup(
    createElement(RemoveFileView, {
      file,
      action: async () => null,
      refusal: refusal && commandErrorText(teamMessages, refusal),
    }),
  );
  return { file, html };
}

function postTargets(targets: readonly string[]): FormData {
  const form = new FormData();
  for (const target of targets) form.append("targets", target);
  return form;
}

/** „Anhängen“ through the Server Action runner – the form the page shows. */
function attachOnForm(fileId: string, origin?: FileOrigin, person: Viewer = tom) {
  const result = { landed: undefined as string | undefined, starts: 0 };
  const action = formRunner({
    currentPerson: async () => person,
    db,
    clock,
    newId: randomUUID,
    storage,
    afterCommit: (events) => void (result.starts += makesAiWork(events) ? 1 : 0),
  })(
    attachFileCommand,
    attachToFileForm(fileId, async () => void (result.landed = attachLanding(fileId, origin))),
  );
  return { result, send: (targets: readonly string[]) => action(null, postTargets(targets)) };
}

/** „Lösen“ through the Server Action runner – the one-tap form on the details page. */
function detachOnDetails(fileId: string, origin?: FileOrigin, person: Viewer = tom) {
  const result = { landed: undefined as string | undefined, starts: 0 };
  const action = formRunner({
    currentPerson: async () => person,
    db,
    clock,
    newId: randomUUID,
    storage,
    afterCommit: (events) => void (result.starts += makesAiWork(events) ? 1 : 0),
  })(
    detachFileCommand,
    detachFileForm(fileId, async ({ target }) => {
      result.landed = detachLanding(fileId, origin, attachmentTargetValue(target));
    }),
  );
  return { result, send: (target: string) => action(null, post({ target })) };
}

/** „Endgültig entfernen“ through the Server Action runner – the question the removal page shows. */
async function removeOnQuestion(fileId: string, version: number) {
  const action = formRunner({ currentPerson: async () => tom, db, clock, newId: randomUUID, storage })(
    removeFileCommandWithAiIndex,
    removeFileForm(fileId, async () => undefined),
  );
  return action(null, post({ version: String(version) }));
}

const filesOf = (html: string) => html;

describe("attaching a file on its details page (ST-115)", () => {
  it("ST-115: A helper attaches a file to several machines and machine models", async () => {
    const manual = await aFileAttachedTo({ models: [medievalMadness] }, "MM Operations Manual");
    const origin: FileOrigin = { kind: "machine", museumNumber: "LG-042" };
    const attach = attachOnForm(manual, origin, ben);

    expect(await attach.send([`machine:${lg050}`, `machine:${lg041}`, `machineModel:${eightBall}`])).toBeNull();

    expect(attach.result.landed).toBe(attachLanding(manual, origin));
    // Attaching starts no indexing and costs nothing (ADR 0018): the runner's after-commit starts no AI work.
    expect(attach.result.starts).toBe(0);
    for (const museumNumber of ["LG-050", "LG-041", "LG-042", "LG-043"]) {
      expect(filesOf(await machineRecordPage(museumNumber))).toContain("MM Operations Manual");
    }
    const details = (await fileDetails(db, manual))!;
    expect(details.attachedTo).toHaveLength(4);
    expect(details.attachedTo).toContainEqual(
      expect.objectContaining({ kind: "machine", machineId: lg041, retired: true }),
    );
    expect(details.attachedTo).toContainEqual(
      expect.objectContaining({ kind: "machine-model", machineModelId: eightBall }),
    );
    const page = await detailsPage(manual, { params: { attached: "1", from: "machine:LG-042" }, person: ben });
    expect(page.html).toContain("LG-041 · Ausgemustert");
    expect(page.html).toContain("„MM Operations Manual“ hängt jetzt an 2 Geräten und 2 Modellen.");
    expect(page.html).toContain(`href="${attachToFileAddress(manual, origin)}"`);
  });

  it("ST-115: Only what can be attached is offered", async () => {
    const manual = await aFileAttachedTo({ machines: [lg042] }, "MM Operations Manual");

    const page = await attachPage(manual);

    expect(page.html).toContain("Geräte");
    expect(page.html).toContain("Modelle");
    // The groups are closed when the page opens, and nothing is ticked (G27).
    expect(page.html).not.toContain("<details open");
    expect(page.html).not.toContain("checked");
    // LG-042 is not offered; the active LG-050 comes before the retired LG-041, although its museum number is lower.
    expect(page.html).not.toContain("LG-042 · Medieval Madness");
    expect(page.html.indexOf("LG-050 · Eight Ball")).toBeLessThan(page.html.indexOf("LG-041 · Ausgemustert"));
  });

  it("ST-115: Nothing left to offer says so", async () => {
    const manual = await aFileAttachedTo(
      { machines: [lg042, lg043, lg041, lg050], models: [medievalMadness, eightBall] },
      "MM Operations Manual",
    );

    const page = await attachPage(manual);

    expect(page.file?.machineGroups).toEqual([]);
    expect(page.file?.machineModelGroups).toEqual([]);
    expect(page.html).toContain("Es gibt nichts mehr, woran sich diese Datei anhängen lässt.");
    expect(page.html).not.toContain("<button");
  });

  it("ST-115: A rejected attach attaches nothing and keeps the choice", async () => {
    const manual = await aFileAttachedTo({}, "MM Operations Manual");
    const attach = attachOnForm(manual);

    const state = await attach.send([]);

    expect(state).toMatchObject({ error: "no-attachment-chosen", chosen: [] });
    expect(attach.result.landed).toBeUndefined();
    expect((await fileDetails(db, manual))!.attachedTo).toEqual([]);
    expect(commandErrorText(teamMessages, "no-attachment-chosen")).toBe(
      "Bitte mindestens ein Gerät oder Modell wählen.",
    );
  });

  it("ST-115: Attaching what is already attached changes nothing", async () => {
    const manual = await aFileAttachedTo({}, "MM Operations Manual");
    // Another team member attached it to LG-050 since the form was opened.
    const attached = await executeCommand(
      attachFileCommand,
      { fileId: manual, machineIds: [lg050], machineModelIds: [] },
      { actor: eva, ...at() },
    );
    if (!attached.ok) throw new Error(attached.error);
    const origin: FileOrigin = { kind: "machine", museumNumber: "LG-042" };
    const attach = attachOnForm(manual, origin);

    expect(await attach.send([`machine:${lg050}`])).toBeNull();

    expect(attach.result.landed).toBe(attachLanding(manual, origin));
    const page = await detailsPage(manual, { params: { attached: "1" } });
    expect(page.html).toContain("„MM Operations Manual“ hängt jetzt an 1 Gerät.");
    expect((await fileDetails(db, manual))!.attachedTo).toHaveLength(1);
    const entries = (await journalOf(db, { aggregateId: manual })).filter(
      (entry) => entry.type === "EVT-FileAttached" && entry.machineId === lg050,
    );
    expect(entries).toHaveLength(1);
  });
});

describe("detaching a file on its details page (ST-115)", () => {
  it("ST-115: A technician detaches a file in one tap", async () => {
    const examples = [
      { kind: "machine" as const, id: () => lg042, name: "LG-042", where: "LG-042" },
      { kind: "machine-model" as const, id: () => medievalMadness, name: "Medieval Madness", where: "LG-043" },
      { kind: "machine" as const, id: () => lg041, name: "LG-041", where: "LG-041" },
    ];

    for (const example of examples) {
      const manual = await aFileAttachedTo(
        {
          machines: example.kind === "machine" ? [example.id(), lg050] : [lg050],
          models: example.kind === "machine-model" ? [example.id()] : [],
        },
        "MM Operations Manual",
      );
      const target = example.kind === "machine" ? `machine:${example.id()}` : `machineModel:${example.id()}`;
      const origin: FileOrigin = { kind: "machine", museumNumber: "LG-042" };
      const detach = detachOnDetails(manual, origin);

      expect(await detach.send(target)).toBeNull();

      // No question in between: the landing is the details, with the confirmation that names the target.
      expect(detach.result.landed).toBe(detachLanding(manual, origin, target));
      expect(detach.result.starts).toBe(0);
      const page = await detailsPage(manual, { params: { detached: target, from: "machine:LG-042" } });
      expect(page.html).toContain(`„MM Operations Manual“ von ${example.name} gelöst.`);
      expect(await machineRecordPage(example.where)).not.toContain("MM Operations Manual");
      expect(await machineRecordPage("LG-050")).toContain("MM Operations Manual");
    }
  });

  it("ST-115: A file detached from everything says so and stays a file", async () => {
    await turnAiOn();
    const fileId = await scenario.attachFile(lg042, {
      title: "Wiring notes",
      bytes: new TextEncoder().encode("The wiring of LG-042."),
      contentType: "text/plain",
    });
    await scenario.run({ kinds: [fileIndexingWork], with: ai() });
    expect(await aiIndexStateOfFile(db, ai(), fileId)).toMatchObject({ state: "indexed" });
    const detach = detachOnDetails(fileId);

    expect(await detach.send(`machine:${lg042}`)).toBeNull();

    const page = await detailsPage(fileId, { params: { detached: `machine:${lg042}` } });
    expect(page.html).toContain("Nirgends angehängt");
    expect(page.html).toContain("Datei öffnen");
    expect(page.html).toContain(teamMessages.aiIndex.fileState.indexed);
    expect(await fileToOpen(db, fileId)).toBeDefined();
    expect(await aiIndexStateOfFile(db, ai(), fileId)).toMatchObject({ state: "indexed" });
  });

  it("ST-115: Helpers cannot detach a file", async () => {
    const fileId = await aFileAttachedTo({ machines: [lg042] }, "Wiring notes");

    const page = await detailsPage(fileId, { person: ben });
    expect(page.html).toContain("Wiring notes");
    expect(page.html).not.toContain("Lösen");
    expect(page.html).not.toContain(`machine:${lg042}`);

    const detach = detachOnDetails(fileId, undefined, ben);
    expect(await detach.send(`machine:${lg042}`)).toMatchObject({ error: "not-authorized" });
    expect((await fileDetails(db, fileId))!.attachedTo).toHaveLength(1);
  });

  it("ST-115: A removed file can be neither attached nor detached", async () => {
    const fileId = await aFileAttachedTo({ machines: [lg042] }, "Old manual");
    const attach = attachOnForm(fileId);
    const detach = detachOnDetails(fileId);
    const removed = await executeCommand(removeFileCommandWithAiIndex, { fileId, version: 0 }, { actor: tom, ...at() });
    if (!removed.ok) throw new Error(removed.error);

    expect(await attach.send([`machine:${lg050}`])).toMatchObject({ error: "file-removed" });
    expect(await detach.send(`machine:${lg042}`)).toMatchObject({ error: "file-removed" });
    expect(await fileDetails(db, fileId)).toBeUndefined();
    expect(await machineRecordPage("LG-042")).not.toContain("Old manual");
    const page = await attachPage(fileId);
    expect(page.file?.removed).toBe(true);
    expect(page.html).toContain("Diese Datei wurde schon entfernt.");
  });

  it("ST-115: A removal asked before a change asks again with the current list", async () => {
    const manual = await aFileAttachedTo({ machines: [lg042] }, "MM Operations Manual");
    const question = await removalQuestion(manual);
    expect(
      question.file.attachedTo.map((target) => (target.kind === "machine" ? target.museumNumber : target.title)),
    ).toEqual(["LG-042"]);
    // A helper attached it to LG-050 since.
    const attached = await executeCommand(
      attachFileCommand,
      { fileId: manual, machineIds: [lg050], machineModelIds: [] },
      { actor: ben, ...at() },
    );
    if (!attached.ok) throw new Error(attached.error);

    const state = await removeOnQuestion(manual, question.file.version);

    expect(state).toMatchObject({ error: "version-conflict" });
    expect(await fileDetails(db, manual)).toBeDefined();
    expect(commandErrorText(teamMessages, "version-conflict")).toBe(
      "Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.",
    );
    const again = await removalQuestion(manual);
    expect(again.html).toContain("LG-042 · Medieval Madness");
    expect(again.html).toContain("LG-050 · Eight Ball");
  });
});

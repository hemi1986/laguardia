import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makesAiWork } from "@/modules/ai-assistance/ai-work-events";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { addFileCommand, createMachineModelCommand, machineRecord, registerMachineCommand } from "@/modules/collection";
import { retireMachineCommand } from "@/modules/repair";
import { formRunner } from "@/app/_actions/form-runner";
import { executeCommand, journalOf, lastCommandBy, type CommittedEvent } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { post } from "@/test-support/forms";
import { hrefOf, textOf } from "@/test-support/html";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { grantUploadAddress } from "@/upload";
import { loadFileDetails } from "../[fileId]/details/file-details-data";
import { FileDetailsView } from "../[fileId]/details/file-details-view";
import { fileDetailsAddress } from "../[fileId]/details/file-origin";
import { FileOverviewView } from "../file-overview";
import { loadFileOverview } from "../file-overview-data";
import { addFileForm } from "./add-file-form";
import { loadAddFileForm } from "./add-file-data";
import { addFileRejection } from "./add-file-form-view";

/**
 * ST-119: „Datei hinzufügen“ in the file overview – the form's data and its Server Action's runner (`formRunner` with the
 * form's definition) against real PostgreSQL and the in-memory store, the pages' data functions and views for the
 * landing and the overview. The file is uploaded from the browser before the form is sent (ST-085). In a database of its
 * own: "no file exists" and the AI settings are about the whole database.
 */
const isolated = isolatedTestDatabase("add_file_from_overview");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = steppingClock("2026-11-04T10:00:00Z");
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
type Viewer = typeof anna | typeof tom;
const viewerOf = (person: Viewer) => ({ id: person.teamMemberId, role: person.role });
const at = () => ({ db, clock, newId: randomUUID });

const scenario = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });
const seam = scenario.openRouter();
const ai = () => scenario.ai(seam);

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, tom, "Tom");
  clock.set("2026-11-04T10:00:00Z");
  storage = memoryStorage();
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

/** What the team member's browser did when the file was chosen: uploaded straight to the store, by name. */
async function aChosenFile({
  by = anna as Viewer,
  contentType = "application/pdf",
  text = "The flipper coil and its fuse.",
} = {}) {
  const bytes = new TextEncoder().encode(text);
  const issued = await grantUploadAddress(
    { db, storage, clock, newId: randomUUID },
    { issuedTo: by.teamMemberId, size: bytes.length, contentType },
  );
  if (!issued.ok) throw new Error(issued.error);
  await storage.upload(issued.address, bytes, contentType, clock.now());
  return issued.name;
}

/** The form sent by a team member: the fields as the browser posts them, `targets` once per ticked entry. */
function sendForm({ by = anna as Viewer } = {}) {
  const landed: string[] = [];
  const work = { started: 0 };
  const action = formRunner({
    currentPerson: async () => by,
    db,
    clock,
    newId: randomUUID,
    storage,
    afterCommit: (events: readonly CommittedEvent[]) => {
      if (makesAiWork(events)) work.started += 1;
    },
  })(
    addFileCommand,
    addFileForm(async ({ fileId }) => void landed.push(fileDetailsAddress(fileId, "files", { added: true }))),
  );
  return {
    landed,
    work,
    send: (fields: Record<string, string>, targets: string[] = []) => {
      const form = post({ fileName: "manual.pdf", ...fields });
      for (const target of targets) form.append("targets", target);
      return action(null, form);
    },
  };
}

const complete = { title: "MM Operations Manual", fileCategory: "manual" };

async function overview(params: Record<string, string> = {}, person: Viewer = anna) {
  const data = await loadFileOverview(db, { params, viewer: viewerOf(person), ai: ai() });
  const html = renderToStaticMarkup(createElement(FileOverviewView, { overview: data }));
  return { html, text: textOf(html) };
}

async function details(fileId: string, params: Record<string, string> = {}, person: Viewer = anna) {
  const file = await loadFileDetails(db, fileId, { params, viewer: viewerOf(person), ai: ai() });
  const html = renderToStaticMarkup(
    createElement(FileDetailsView, { file: file!, retry: async () => null, detach: async () => null }),
  );
  return { html, text: textOf(html) };
}

describe("„Datei hinzufügen“ in the file overview", () => {
  it("ST-119: A helper adds the first file, attached to nothing", async () => {
    // Given no file exists, the overview says so and offers the button below its sentence; a removed file counts as none.
    const empty = await overview();
    expect(empty.text).toContain("Noch keine Dateien.");
    expect(hrefOf(empty.html, "Datei hinzufügen")).toBe("/team/dateien/hinzufuegen");
    expect(empty.text.indexOf("Noch keine Dateien.")).toBeLessThan(empty.text.indexOf("Datei hinzufügen"));

    // The form: the file, the title, the four file categories in order with none preselected, the optional choice.
    const form = await loadAddFileForm(db);
    expect(form.fileCategories).toEqual(["manual", "schematic", "photo", "other"]);
    expect(form.back).toBe("/team/dateien");

    // The helper adds the PDF without choosing anything to attach it to.
    const content = await aChosenFile();
    const sent = sendForm();
    expect(await sent.send({ ...complete, content, fileName: "medieval_manual-v2.pdf" })).toBeNull();
    expect(sent.work.started).toBe(1);
    expect(sent.landed).toHaveLength(1);

    // Then the helper is on the file's details with the confirmation, and it is attached to nothing.
    const [landing] = sent.landed;
    const fileId = /dateien\/([^/]+)\/details/.exec(landing)![1];
    expect(landing).toBe(`/team/dateien/${fileId}/details?from=files&added=1`);
    const opened = await details(fileId, { from: "files", added: "1" });
    expect(opened.text).toContain("„MM Operations Manual“ hinzugefügt.");
    expect(opened.text).toContain("Angehängt an Nirgends angehängt");
    expect(opened.text).toContain("Ursprünglicher Dateiname: medieval_manual-v2.pdf");
    // Never from the address alone: another team member opening the same address sees no confirmation.
    expect((await details(fileId, { from: "files", added: "1" }, tom)).text).not.toContain("hinzugefügt.");
    // And „Dateien“ lists it.
    const listed = await overview();
    expect(listed.text).toContain("MM Operations Manual");
    expect(hrefOf(listed.html, "Datei hinzufügen")).toBe("/team/dateien/hinzufuegen");
  });

  it("ST-119: Adding and attaching happen in one step", async () => {
    const eightBall = await aModel("Eight Ball");
    const medievalMadness = await aModel("Medieval Madness");
    const lg042 = await aMachine(medievalMadness, "LG-042");
    const lg041 = await aMachine(eightBall, "LG-041");
    await aMachine(eightBall, "LG-050");
    await retire(lg041);

    // The choice offers all of them: the retired machine at the end of its group, as „LG-041 · Ausgemustert“.
    const form = await loadAddFileForm(db);
    const machineLabels = form.machineGroups.flatMap((group) => group.entries.map((entry) => entry.label));
    expect(machineLabels).toEqual(["LG-042 · Medieval Madness", "LG-050 · Eight Ball", "LG-041 · Ausgemustert"]);
    expect(form.machineModelGroups.flatMap((group) => group.entries.map((entry) => entry.label))).toEqual([
      "Eight Ball",
      "Medieval Madness",
    ]);

    const content = await aChosenFile({ by: tom });
    const sent = sendForm({ by: tom });
    const entry = (label: string) =>
      [...form.machineGroups, ...form.machineModelGroups]
        .flatMap((group) => group.entries)
        .find((e) => e.label === label)!.value;
    expect(
      await sent.send({ ...complete, title: "Operations", content }, [
        entry("LG-042 · Medieval Madness"),
        entry("LG-041 · Ausgemustert"),
        entry("Eight Ball"),
      ]),
    ).toBeNull();

    // The machine records of LG-042, of LG-041 and of every machine of "Eight Ball" (LG-050) show it.
    for (const museumNumber of ["LG-042", "LG-041", "LG-050"]) {
      expect((await machineRecord(db, museumNumber))!.files.map((file) => file.title)).toContain("Operations");
    }
    // The journal records the file added and attached to all three in one step.
    const fileId = /dateien\/([^/]+)\/details/.exec(sent.landed[0])![1];
    expect((await lastCommandBy(db, { aggregateId: fileId }, tom.teamMemberId))?.map((entry) => entry.type)).toEqual([
      "EVT-FileAdded",
      "EVT-FileAttached",
      "EVT-FileAttached",
      "EVT-FileAttached",
    ]);
    const attached = (await journalOf(db, { aggregateId: fileId })).filter((e) => e.type === "EVT-FileAttached");
    expect(attached.map((e) => e.machineId ?? e.data.machineModelId).sort()).toEqual([lg042, lg041, eightBall].sort());
  });

  it("ST-119: A rejected form says what happened to the chosen file", async () => {
    const texts = { ...teamMessages.addFileToOverview.form };
    const rows = [
      { filledIn: "no title", fields: { ...complete, title: "  " }, reason: "Bitte einen Titel angeben." },
      {
        filledIn: "no file category",
        fields: { ...complete, fileCategory: "" },
        reason: "Bitte eine Dateikategorie wählen.",
      },
    ];
    for (const { fields, reason } of rows) {
      const content = await aChosenFile();
      const sent = sendForm();

      const state = await sent.send({ ...fields, content }, ["machine:" + randomUUID()]);

      // Rejected, no file added; what was filled in is still there, and the file is still attached (not deleted).
      expect(state).toMatchObject({
        values: { title: fields.title, fileCategory: fields.fileCategory, content, fileName: "manual.pdf" },
      });
      expect(state!.chosen).toHaveLength(1);
      expect(addFileRejection(state!, texts)).toBe(`${reason} Die gewählte Datei ist noch angehängt: manual.pdf`);
      expect(sent.landed).toEqual([]);
      expect(storage.read(content)).toBeDefined();
      expect((await overview()).text).toContain("Noch keine Dateien.");
    }

    // Sent without a file at all: nothing to say about it, and once the content is gone it must be chosen again.
    const none = await sendForm().send({ ...complete, content: "", fileName: "" });
    expect(none).toMatchObject({ error: "file-required" });
    expect(addFileRejection(none!, texts)).toBe("Bitte eine Datei auswählen.");
    const gone = await sendForm().send({ ...complete, content: `files/${randomUUID()}` });
    expect(gone).toMatchObject({ error: "content-gone", values: { content: "", fileName: "" } });
    expect(addFileRejection(gone!, texts)).toMatch(/Die Datei muss erneut ausgewählt werden\.$/);
  });

  it("refuses someone not logged in at the form's runner, and adds nothing", async () => {
    const content = await aChosenFile();
    const landed: string[] = [];
    const run = formRunner({ currentPerson: async () => ({ kind: "visitor" }), db, clock, newId: randomUUID, storage })(
      addFileCommand,
      addFileForm(async ({ fileId }) => void landed.push(fileId)),
    );

    const answer = await run(null, post({ ...complete, content, fileName: "x.pdf" }));

    // A pending upload is issued to a team member: nothing of a visitor's matches it, so the upload step stops first
    // (CMD-AddFile itself refuses a visitor too – `add-file-command.integration.test.ts`).
    expect(answer).toMatchObject({ error: "content-gone" });
    expect(storage.read(content)).toBeDefined();
    expect(landed).toEqual([]);
    expect((await overview()).text).toContain("Noch keine Dateien.");
  });
});

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  changeFileDetailsCommand,
  createMachineModelCommand,
  fileDetails,
  machineRecord,
  registerMachineCommand,
  removeFileCommand,
  type FileCategory,
} from "@/modules/collection";
import { formRunner } from "@/app/_actions/form-runner";
import { rejectionText } from "@/app/_actions/rejection-text";
import { steppingClock } from "@/modules/ai-assistance/ai-work-stand-in.test-support";
import { executeCommand, journalOf } from "@/platform/command";
import { aFileAdded } from "@/test-support/files";
import { hrefOf, labelOf, selectedOf, textOf } from "@/test-support/html";
import { post } from "@/test-support/forms";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadFileDetails } from "../file-details-data";
import { FileDetailsView } from "../file-details-view";
import { loadChangeFileDetails } from "./change-file-details-data";
import { changeFileDetailsForm } from "./change-file-details-form";
import { ChangeFileDetailsView } from "./change-file-details-view";

/**
 * ST-116: correcting a file's title and file category. The form is the page data function rendered by its view; saving runs
 * through the Server Action runner with the real form definition, against real PostgreSQL. Files are added through
 * Collection's command (`aFileAdded`).
 */
const isolated = isolatedTestDatabase("change_file_details_page");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-05T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
type Person = typeof tom | typeof anna;
const at = () => ({ db, clock, newId: randomUUID });
let lg042: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  await anExistingTeamMember(db, anna, "Anna");
  await anExistingTeamMember(db, ben, "Ben");
  clock.set("2026-11-05T10:00:00Z");
  const model = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
    { actor: tom, ...at() },
  );
  if (!model.ok) throw new Error(model.error);
  const machine = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: model.result.machineModelId,
      museumNumber: "LG-042",
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, ...at() },
  );
  if (!machine.ok) throw new Error(machine.error);
  lg042 = machine.result.machineId;
});

/** A file attached to LG-042, with the file category it was added with. */
const aFile = (title: string, fileCategory: FileCategory) =>
  aFileAdded(db, { actor: tom, clock }, { machineId: lg042, title, fileCategory });

const viewerOf = (person: Person) => ({ id: person.teamMemberId, role: person.role });

/** The form as a team member opens it. */
async function form(fileId: string, person: Person = anna) {
  const file = await loadChangeFileDetails(db, fileId, { params: {}, viewer: viewerOf(person) });
  const html = file
    ? renderToStaticMarkup(createElement(ChangeFileDetailsView, { file, action: async () => null }))
    : "";
  return { file: file!, html };
}

/** „Datei speichern“ through the Server Action runner – the form the page shows. */
function save(fileId: string, person: Person = anna) {
  const landed: { fileId: string; title: string }[] = [];
  const run = formRunner({ currentPerson: async () => person, db, clock, newId: randomUUID })(
    changeFileDetailsCommand,
    changeFileDetailsForm(fileId, async (result) => void landed.push(result)),
  );
  return { landed, send: (fields: Record<string, string>) => run(null, post(fields)) };
}

/** The file details as a team member opens them after the landing. */
async function detailsPage(fileId: string, params: Record<string, string> = {}) {
  const file = await loadFileDetails(db, fileId, { params, viewer: viewerOf(anna) });
  return renderToStaticMarkup(
    createElement(FileDetailsView, { file: file!, retry: async () => null, detach: async () => null }),
  );
}

const changesOf = async (fileId: string) =>
  (await journalOf(db, { aggregateId: fileId })).filter((entry) => entry.type === "EVT-FileDetailsChanged");

describe("correcting a file's title and file category (ST-116)", () => {
  it("ST-116: A helper corrects title and file category", async () => {
    const manual = await aFile("MM Operations Manul", "other");
    const { file } = await form(manual);

    const saved = save(manual);
    const answer = await saved.send({
      title: "MM Operations Manual",
      fileCategory: "manual",
      version: String(file.version),
    });

    // The helper lands on the file details with the confirmation; the details show the corrected title.
    expect(answer).toBeNull();
    expect(saved.landed).toEqual([{ fileId: manual, title: "MM Operations Manual" }]);
    const page = await detailsPage(manual, { saved: "1" });
    expect(textOf(page)).toContain("„MM Operations Manual“ gespeichert.");
    // The machine record of LG-042 shows it under Manual.
    expect((await machineRecord(db, "LG-042"))!.files).toEqual([
      expect.objectContaining({ id: manual, title: "MM Operations Manual", fileCategory: "manual" }),
    ]);
    // The journal records which details changed, without the typed title.
    const [change] = await changesOf(manual);
    expect(change).toMatchObject({
      actor: { teamMemberId: anna.teamMemberId },
      data: { changedDetails: ["title", "fileCategory"], fileCategory: "manual" },
    });
    expect(JSON.stringify(change.data)).not.toContain("Operations");
  });

  it("ST-116: The form is headed with the file and has its current values", async () => {
    const manual = await aFile("MM Operations Manual", "manual");

    const { html } = await form(manual);

    expect(html).toContain("Datei bearbeiten · MM Operations Manual</h1>");
    expect(labelOf(html, "title")).toBe("Titel");
    expect(html).toMatch(/<input[^>]*name="title"[^>]*value="MM Operations Manual"/);
    expect(labelOf(html, "fileCategory")).toBe("Dateikategorie");
    expect(selectedOf(html, "fileCategory")).toBe("manual");
    expect([...html.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((option) => option[1])).toEqual([
      "Handbuch",
      "Schaltplan",
      "Foto",
      "Sonstiges",
    ]);
    expect(html).toContain("Datei speichern");
    expect(hrefOf(html, "Zurück zur Datei")).toBe(`/team/dateien/${manual}/details`);
  });

  it("ST-116: An empty title is rejected", async () => {
    const manual = await aFile("MM Operations Manual", "manual");

    const saved = save(manual);
    const answer = await saved.send({ title: "  ", fileCategory: "schematic", version: "0" });

    // Rejected with the title marked; what was typed stays, and nothing changed.
    expect(answer).toEqual({
      error: "title-required",
      values: { title: "  ", fileCategory: "schematic", version: "0" },
    });
    expect(rejectionText(answer!.error)).toBe("Bitte einen Titel angeben.");
    expect(saved.landed).toEqual([]);
    expect(await fileDetails(db, manual)).toMatchObject({ title: "MM Operations Manual", fileCategory: "manual" });
    expect(await changesOf(manual)).toEqual([]);
  });

  it("ST-116: A file without a file category is rejected", async () => {
    const manual = await aFile("MM Operations Manual", "manual");

    const saved = save(manual);
    const answer = await saved.send({ title: "MM Manual", version: "0" });
    const forged = await save(manual).send({ title: "MM Manual", fileCategory: "bogus", version: "0" });

    expect(answer).toMatchObject({ error: "file-category-required", values: { title: "MM Manual" } });
    expect(forged).toMatchObject({ error: "file-category-required" });
    expect(rejectionText(answer!.error)).toBe("Bitte eine Dateikategorie wählen.");
    expect(await fileDetails(db, manual)).toMatchObject({ title: "MM Operations Manual", fileCategory: "manual" });
    expect(await changesOf(manual)).toEqual([]);
  });

  it("ST-116: Saving without a change is confirmed and records nothing", async () => {
    const manual = await aFile("MM Operations Manual", "manual");
    const { file } = await form(manual);

    const saved = save(manual);
    const answer = await saved.send({
      title: "MM Operations Manual",
      fileCategory: "manual",
      version: String(file.version),
    });

    expect(answer).toBeNull();
    expect(saved.landed).toEqual([{ fileId: manual, title: "MM Operations Manual" }]);
    expect(textOf(await detailsPage(manual, { saved: "1" }))).toContain("„MM Operations Manual“ gespeichert.");
    expect(await changesOf(manual)).toEqual([]);
    // The version stays: the form just shown still saves.
    expect((await form(manual)).file.version).toBe(file.version);
    // Not even a stale version is a conflict when nothing is written.
    expect(
      await save(manual).send({ title: "MM Operations Manual", fileCategory: "manual", version: "99" }),
    ).toBeNull();
  });

  it("ST-116: A change made meanwhile rejects the form and keeps what was typed", async () => {
    const manual = await aFile("MM Operations Manul", "manual");
    const { file } = await form(manual);
    const other = await save(manual, tom).send({
      title: "MM Operations Manual",
      fileCategory: "manual",
      version: String(file.version),
    });
    expect(other).toBeNull();

    const answer = await save(manual).send({
      title: "MM Manual",
      fileCategory: "manual",
      version: String(file.version),
    });

    expect(answer).toEqual({
      error: "version-conflict",
      values: { title: "MM Manual", fileCategory: "manual", version: String(file.version) },
    });
    expect(rejectionText(answer!.error)).toBe(
      "Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.",
    );
    // The other team member's correction is still there.
    expect((await fileDetails(db, manual))!.title).toBe("MM Operations Manual");
    expect(await changesOf(manual)).toHaveLength(1);
  });

  it("ST-116: A removed file cannot be corrected", async () => {
    const old = await aFile("Old manual", "manual");
    const { file } = await form(old);
    const removed = await executeCommand(
      removeFileCommand,
      { fileId: old, version: file.version },
      { actor: tom, ...at() },
    );
    if (!removed.ok) throw new Error(removed.error);

    const saved = save(old);
    const answer = await saved.send({
      title: "Old manual 2",
      fileCategory: "schematic",
      version: String(file.version),
    });

    expect(answer).toMatchObject({ error: "file-removed", values: { title: "Old manual 2" } });
    expect(rejectionText(answer!.error)).toBe("Diese Datei wurde schon entfernt.");
    expect(saved.landed).toEqual([]);
    // It shows nowhere; the form answered again says that it is gone and offers no save.
    expect(await fileDetails(db, old)).toBeUndefined();
    expect((await machineRecord(db, "LG-042"))!.files).toEqual([]);
    const again = await form(old);
    expect(again.file.removed).toBe(true);
    expect(again.html).not.toContain("Datei speichern");
    expect(await changesOf(old)).toEqual([]);
    // An unknown or forged address names no file.
    expect(await loadChangeFileDetails(db, randomUUID(), { params: {}, viewer: viewerOf(anna) })).toBeUndefined();
    expect(await loadChangeFileDetails(db, "../../etc", { params: {}, viewer: viewerOf(anna) })).toBeUndefined();
  });
});

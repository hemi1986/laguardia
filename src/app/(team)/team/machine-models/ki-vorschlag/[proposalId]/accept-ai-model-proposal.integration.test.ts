import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  acceptAiModelProposalCommand,
  aiModelProposalPage,
  aiModelProposalWork,
  openAiModelProposals,
} from "@/modules/ai-assistance";
import { anIndexedFile } from "@/modules/ai-assistance/ai-index.test-support";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { geminiEmbedding } from "@/modules/ai-assistance/ai-seam.test-support";
import {
  createMachineModelCommand,
  fileDetails,
  fileForRemoval,
  machineModelsToChooseFrom,
  removeFileCommand,
} from "@/modules/collection";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { formRunner } from "@/app/_actions/form-runner";
import { aiModelProposalAddress as proposalAddress } from "../../mit-ki-erstellen/request-ai-model-proposal-definition";
import { acceptAiModelProposalForm } from "./accept-ai-model-proposal-definition";
import { WrittenAiModelProposal } from "./written-proposal";
import { SavedAiModelProposal } from "./saved-proposal";

/**
 * ST-128: „Speichern“ on the written proposal's page – the machine model with the fields as corrected and the existing
 * files as ticked, in one transaction (CMD-AcceptAiModelProposal, ADR 0019). The Server Action runner is tested with the
 * acting person `currentPerson()` would give; the proposal's page is read from the same database afterwards.
 */
const isolated = isolatedTestDatabase("ai_model_proposal_accept");
let db: NodePgDatabase;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const NOW = "2026-11-07T12:00:00Z";
const clock = fixedClock(NOW);
const texts = teamMessages.aiModelProposals;
const scenario = aiScenario({ db: () => db, clock, technician: tom });

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

afterAll(() => isolated.close());

beforeEach(async () => {
  for (const table of [
    "ai_work_hold",
    "ai_model_proposal",
    "ai_index_item",
    "ai_index_entry",
    "file_attachment",
    "file",
  ])
    await db.execute(`DELETE FROM ${table}`);
  // Machine models nobody registered a machine for – the ones earlier tests saved.
  await db.execute(
    "DELETE FROM machine_model_category_change WHERE machine_model_id NOT IN (SELECT machine_model_id FROM machine)",
  );
  await db.execute("DELETE FROM machine_model WHERE id NOT IN (SELECT machine_model_id FROM machine)");
  await scenario.turnAiOn();
});

const highSpeed = {
  title: "High Speed",
  manufacturer: "Williams",
  year: "1986",
  machineCategory: "pinball",
  technology: "solid-state",
  sources: [],
  documents: [
    { title: "High Speed – Manual", fileCategory: "manual", link: "https://www.ipdb.org/files/1203/manual.pdf" },
  ],
};

/** A file the museum has, attached to a machine model, with an AI index entry of the current embedding model. */
async function anIndexedFileOfTheMuseum(title: string, fileCategory = "other") {
  const machineId = await aRegisteredMachine(db);
  const fileId = await scenario.attachFile(machineId, {
    title,
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "application/pdf",
    to: "machine-model",
    fileCategory: fileCategory as "manual",
  });
  await anIndexedFile(db, clock, fileId, { embeddingModel: geminiEmbedding.id, pages: 1, text: title });
  return fileId;
}

/** Requests a proposal and runs the background work once: the proposal is written. */
async function aWrittenProposal(answer: Record<string, unknown> = highSpeed) {
  const openRouter = scenario.openRouter({ chatAnswer: { content: JSON.stringify(answer), cost: 0.04 } });
  const id = await scenario.requestAiModelProposal("Flipper High Speed Williams");
  await scenario.run({ kinds: [aiModelProposalWork], with: openRouter });
  return id;
}

/** The form as the written page shows it: the proposed fields, every document ticked – unless the test changes it. */
async function posted(
  id: string,
  { change = {}, ticked }: { change?: Record<string, string>; ticked?: readonly string[] } = {},
): Promise<FormData> {
  const proposal = await aiModelProposalPage(db, id);
  if (!proposal?.fields || proposal.version === undefined) throw new Error("not written");
  const form = new FormData();
  form.append("aiModelProposalId", id);
  form.append("version", String(proposal.version));
  const values: Record<string, string> = {
    title: proposal.fields.title ?? "",
    manufacturer: proposal.fields.manufacturer ?? "",
    year: proposal.fields.year?.toString() ?? "",
    machineCategory: proposal.fields.machineCategory ?? "",
    technology: proposal.fields.technology ?? "",
    ...change,
  };
  for (const [name, value] of Object.entries(values)) form.append(name, value);
  (proposal.documents ?? []).forEach((document, index) => {
    form.append(`documentTitle-${index}`, document.title);
    form.append(`documentFileCategory-${index}`, document.fileCategory);
  });
  for (const index of ticked ?? (proposal.documents ?? []).map((_, index) => String(index)))
    form.append("document", index);
  return form;
}

function theForm(onLanded: (address: string) => void = () => undefined) {
  return formRunner({ currentPerson: async () => tom, db, clock, newId: randomUUID })(
    acceptAiModelProposalCommand,
    acceptAiModelProposalForm({
      onSuccess: async ({ aiModelProposalId }) => onLanded(proposalAddress(aiModelProposalId)),
    }),
  );
}

const modelsCalled = async (title: string, manufacturer = "Williams") =>
  (await machineModelsToChooseFrom(db)).filter((model) => model.title === title && model.manufacturer === manufacturer);

describe("saving an AI model proposal", () => {
  it("ST-128: Saving creates the machine model and attaches the chosen files", async () => {
    const wiki = await anIndexedFileOfTheMuseum("Pinball wiki – System 11");
    const id = await aWrittenProposal();
    let landed = "";

    // The technician changes the year from 1986 to 1987 and saves – the file is ticked, the link is not.
    const state = await theForm((address) => (landed = address))(
      null,
      await posted(id, { change: { year: "1987" }, ticked: ["0"] }),
    );

    expect(state).toBeNull();
    // The machine model exists with the year as corrected …
    const [model] = await modelsCalled("High Speed");
    expect(model).toMatchObject({ manufacturer: "Williams", year: 1987, machineCategory: "pinball" });
    // … and the file is attached to it.
    expect((await fileDetails(db, wiki))?.attachedTo).toContainEqual(
      expect.objectContaining({ kind: "machine-model", machineModelId: model.id }),
    );
    // The technician lands on the proposal's page, which names the machine model, the file and the waiting link.
    expect(landed).toBe(proposalAddress(id));
    const page = await aiModelProposalPage(db, id);
    expect(page?.state).toBe("accepted");
    const html = renderToStaticMarkup(createElement(SavedAiModelProposal, { proposal: page! }));
    expect(html).toContain(texts.saved);
    expect(html).toContain(`href="/team/machine-models/${model.id}"`);
    expect(html).toContain("Pinball wiki – System 11");
    // The proposal keeps what the AI proposed; the machine model has the corrected year.
    expect(page?.fields).toBeUndefined();
    // The journal: the proposal accepted, the machine model created and the file attached – by the technician, in one step.
    const types = (await journalOf(db, { aggregateId: id })).map((entry) => entry.type);
    expect(types).toContain("EVT-AiModelProposalAccepted");
    const created = (await journalOf(db, { aggregateId: model.id })).map((entry) => entry.type);
    expect(created).toEqual(["EVT-MachineModelCreated"]);
  });

  it("ST-128: A rejected form keeps what was typed", async () => {
    const wiki = await anIndexedFileOfTheMuseum("Pinball wiki – System 11");
    const id = await aWrittenProposal({ ...highSpeed, manufacturer: undefined });

    // The technician saves without a manufacturer.
    const state = await theForm()(null, await posted(id, { ticked: ["0", "1"] }));

    expect(state?.error).toBe("manufacturer-required");
    expect(teamMessages.commandErrors["manufacturer-required"]).toBe("Bitte einen Hersteller angeben.");
    // The fields and the ticks are as they were.
    expect(state?.values).toMatchObject({ title: "High Speed", year: "1986", manufacturer: "" });
    expect(state?.chosen).toEqual(["0", "1"]);
    // Nothing was created or attached, and the proposal is still written.
    expect((await machineModelsToChooseFrom(db)).filter((model) => model.title === "High Speed")).toEqual([]);
    expect((await fileDetails(db, wiki))?.attachedTo).toHaveLength(1);
    expect((await aiModelProposalPage(db, id))?.state).toBe("written");
  });

  it("ST-128: A proposal that was saved already", async () => {
    const id = await aWrittenProposal();
    // The other technician saved it a moment ago – this form was opened before.
    const stale = await posted(id);
    expect(await theForm()(null, await posted(id))).toBeNull();

    const state = await theForm()(null, stale);

    expect(state?.error).toBe("ai-model-proposal-already-accepted");
    expect(teamMessages.commandErrors["ai-model-proposal-already-accepted"]).toBe(
      "Dieser KI-Vorschlag wurde schon gespeichert.",
    );
    expect(await modelsCalled("High Speed")).toHaveLength(1);
  });

  it("ST-128: A machine model with the same title and manufacturer exists", async () => {
    const existing = await executeCommand(
      createMachineModelCommand,
      { title: "High Speed", manufacturer: "Williams", machineCategory: "pinball" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!existing.ok) throw new Error(existing.error);
    const id = await aWrittenProposal();

    // Opening the written proposal shows the hint with a link to the existing machine model.
    const page = await aiModelProposalPage(db, id);
    const html = renderToStaticMarkup(createElement(WrittenAiModelProposal, { proposal: page! }));
    expect(html).toContain("Ein Modell mit diesem Titel und Hersteller gibt es schon.");
    expect(html).toContain(`href="/team/machine-models/${existing.result.machineModelId}"`);

    // Saving is still possible: a second machine model exists then.
    expect(await theForm()(null, await posted(id))).toBeNull();
    expect(await modelsCalled("High Speed")).toHaveLength(2);
  });

  it("a ticked file removed meanwhile rejects saving, names the document and stores nothing", async () => {
    const wiki = await anIndexedFileOfTheMuseum("Pinball wiki – System 11");
    const id = await aWrittenProposal();
    const form = await posted(id, { ticked: ["0", "1"] });
    const removed = await executeCommand(
      removeFileCommand,
      { fileId: wiki, version: (await fileForRemoval(db, wiki))!.version },
      { actor: tom, db, clock, newId: randomUUID },
    );
    expect(removed.ok).toBe(true);

    const state = await theForm()(null, form);

    expect(state?.error).toBe("ai-model-proposal-document-removed");
    expect(state?.subjects).toEqual([wiki]);
    expect(state?.chosen).toEqual(["0", "1"]);
    // All or nothing: no machine model, the proposal is still written and now shows the document as removed.
    expect(await modelsCalled("High Speed")).toEqual([]);
    const page = await aiModelProposalPage(db, id);
    expect(page?.state).toBe("written");
    expect(page?.documents?.[0]).toMatchObject({ kind: "file", removed: true });
  });

  it("only documents of the proposal can be chosen and a link's title and file category can be changed", async () => {
    const id = await aWrittenProposal();

    const forged = await theForm()(null, await posted(id, { ticked: ["7"] }));
    expect(forged?.error).toBe("ai-model-proposal-document-unknown");

    const form = await posted(id, { ticked: ["0"] });
    form.set("documentTitle-0", "High Speed – Schaltplan");
    form.set("documentFileCategory-0", "schematic");
    expect(await theForm()(null, form)).toBeNull();
    const page = await aiModelProposalPage(db, id);
    expect(page?.documents).toEqual([
      expect.objectContaining({
        kind: "link",
        title: "High Speed – Schaltplan",
        fileCategory: "schematic",
        loading: "waiting",
      }),
    ]);
    // The saved proposal stays open in „KI-Vorschläge“ while the link waits (RM-AiModelProposals).
    expect((await openAiModelProposals(db, scenario.ai())).proposals.map((proposal) => proposal.id)).toContain(id);
  });

  it("saving works while AI is off", async () => {
    const id = await aWrittenProposal();
    await scenario.removeTheKey();

    expect(await theForm()(null, await posted(id, { ticked: [] }))).toBeNull();
    expect(await modelsCalled("High Speed")).toHaveLength(1);
  });
});


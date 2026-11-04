import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, lastCommandBy } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { machinesOfOneModel as ofOneModel } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { addFileCommand, machineModelOfMachineForAi, machineRecord } from ".";
import type { AddFileInput } from ".";

/**
 * CMD-AddFile (ST-037, ST-113) through the command layer, observed through the machine record (RM-MachineRecord: files
 * of the machine and its machine model by file category) and the journal. The content is what the upload module hands
 * over after a direct upload (ST-085) – here only its name, size and media type.
 */
const db = testDatabase();
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = { db, clock: fixedClock("2026-10-18T10:00:00Z"), newId: randomUUID };

beforeAll(async () => {
  for (const member of [tom, anna]) await anExistingTeamMember(db, member);
});

const machinesOfOneModel = (count: number) => ofOneModel(db, count);

const aPdf = () => ({ name: `files/${randomUUID()}`, size: 4_200_000, contentType: "application/pdf" });

/** Adds a file to the machine ("machine"), to its machine model ("machine-model") or to both. */
async function add(
  machineId: string,
  to: "machine" | "machine-model" | "both" | "nothing" = "machine",
  input: Partial<AddFileInput> = {},
  actor: typeof tom | typeof anna = anna,
) {
  const model = (await machineModelOfMachineForAi(db, machineId))!;
  return executeCommand(
    addFileCommand,
    {
      title: "A file",
      fileCategory: "other",
      originalFileName: "a-file.pdf",
      machineIds: to === "machine" || to === "both" ? [machineId] : [],
      machineModelIds: to === "machine-model" || to === "both" ? [model.id] : [],
      content: aPdf(),
      ...input,
    },
    { actor, ...at },
  );
}

const filesOf = async (museumNumber: string) =>
  (await machineRecord(db, museumNumber))!.files.map(({ title, fileCategory }) => ({ title, fileCategory }));

describe("CMD-AddFile", () => {
  it("ST-037: Helper attaches a manual to a machine model", async () => {
    const [lg042, lg043] = await machinesOfOneModel(2);

    const added = await add(lg042.machineId, "machine-model", { title: "MM Operations Manual", fileCategory: "manual" });

    expect(added.ok).toBe(true);
    expect(await filesOf(lg042.museumNumber)).toEqual([{ title: "MM Operations Manual", fileCategory: "manual" }]);
    expect(await filesOf(lg043.museumNumber)).toEqual([{ title: "MM Operations Manual", fileCategory: "manual" }]);
  });

  it("ST-037: Team member attaches a file to a single machine", async () => {
    const [lg042, lg043] = await machinesOfOneModel(2);

    await add(lg042.machineId, "machine", { title: "LG-042 wiring notes", fileCategory: "other" }, tom);

    expect(await filesOf(lg042.museumNumber)).toEqual([{ title: "LG-042 wiring notes", fileCategory: "other" }]);
    expect(await filesOf(lg043.museumNumber)).toEqual([]);
  });

  it("ST-113: A file attached to the machine and its machine model shows once", async () => {
    const [lg042, lg043] = await machinesOfOneModel(2);

    await add(lg042.machineId, "both", { title: "MM Operations Manual", fileCategory: "manual" });

    for (const { museumNumber } of [lg042, lg043])
      expect((await machineRecord(db, museumNumber))!.files).toMatchObject([
        { title: "MM Operations Manual", fileCategory: "manual", ofMachineModel: true },
      ]);
  });

  it("adds a file that is attached to nothing, and it shows on no machine record", async () => {
    const [lg042] = await machinesOfOneModel(1);

    const added = await add(lg042.machineId, "nothing", { title: "On its own" });
    if (!added.ok) throw new Error(added.error);

    expect(await filesOf(lg042.museumNumber)).toEqual([]);
    expect((await journalOf(db, { aggregateId: added.result.fileId })).map((entry) => entry.type)).toEqual([
      "EVT-FileAdded",
    ]);
  });

  it("rejects a file without title, file category or content itself – whatever form sends it – and one for an unknown machine or machine model", async () => {
    const [lg042] = await machinesOfOneModel(1);

    expect(await add(lg042.machineId, "machine", { title: " " })).toEqual({ ok: false, error: "title-required" });
    expect(await add(lg042.machineId, "machine", { fileCategory: undefined })).toEqual({
      ok: false,
      error: "file-category-required",
    });
    expect(await add(lg042.machineId, "machine", { content: undefined })).toEqual({
      ok: false,
      error: "file-required",
    });
    expect(await add(lg042.machineId, "machine", { machineIds: [randomUUID()] })).toEqual({
      ok: false,
      error: "unknown-machine",
    });
    expect(await add(lg042.machineId, "machine", { machineIds: ["not-an-id"] })).toEqual({
      ok: false,
      error: "unknown-machine",
    });
    expect(await add(lg042.machineId, "nothing", { machineModelIds: [randomUUID()] })).toEqual({
      ok: false,
      error: "unknown-machine-model",
    });
    expect(await filesOf(lg042.museumNumber)).toEqual([]);
  });

  it("journals the file added and its attachment in one step – never the title or the original file name", async () => {
    const [lg042] = await machinesOfOneModel(1);

    const added = await add(lg042.machineId, "machine", {
      title: "Secret-ish notes",
      fileCategory: "schematic",
      originalFileName: "secret-ish-notes-v2.pdf",
    });
    if (!added.ok) throw new Error(added.error);

    const entries = await journalOf(db, { aggregateId: added.result.fileId });
    expect(entries).toMatchObject([
      {
        type: "EVT-FileAdded",
        aggregate: { type: "AGG-File", id: added.result.fileId },
        machineId: null,
        actor: anna,
        data: { fileCategory: "schematic" },
      },
      {
        type: "EVT-FileAttached",
        aggregate: { type: "AGG-File", id: added.result.fileId },
        machineId: lg042.machineId,
        actor: anna,
        data: { machineModelId: null },
      },
    ]);
    // One command wrote both: the latest command on the file holds the two events.
    expect((await lastCommandBy(db, { aggregateId: added.result.fileId }, anna.teamMemberId))?.map((e) => e.type)).toEqual(
      ["EVT-FileAdded", "EVT-FileAttached"],
    );
    expect(JSON.stringify(entries)).not.toMatch(/Secret-ish|secret-ish/);
  });

  it("shows the files grouped by file category in glossary order, each group by title", async () => {
    const [lg042] = await machinesOfOneModel(1);
    for (const [title, fileCategory] of [
      ["Z other", "other"],
      ["B schematic", "schematic"],
      ["Photo of the playfield", "photo"],
      ["A schematic", "schematic"],
      ["Manual", "manual"],
    ] as const) {
      await add(lg042.machineId, "machine", { title, fileCategory });
    }

    expect((await filesOf(lg042.museumNumber)).map((file) => file.title)).toEqual([
      "Manual",
      "A schematic",
      "B schematic",
      "Photo of the playfield",
      "Z other",
    ]);
  });
});

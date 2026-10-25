import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { machinesOfOneModel as ofOneModel } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { attachFileCommand, machineRecord } from ".";
import type { AttachFileInput } from ".";

/**
 * CMD-AttachFile (ST-037) through the command layer, observed through the machine record (RM-MachineRecord: files of
 * the machine and its machine model by file category) and the journal. The content is what the upload module hands
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

function attach(
  input: Partial<AttachFileInput> & Pick<AttachFileInput, "machineId">,
  actor: typeof tom | typeof anna = anna,
) {
  return executeCommand(
    attachFileCommand,
    { attachTo: "machine", title: "A file", fileCategory: "other", content: aPdf(), ...input },
    { actor, ...at },
  );
}

const filesOf = async (museumNumber: string) =>
  (await machineRecord(db, museumNumber))!.files.map(({ title, fileCategory }) => ({ title, fileCategory }));

describe("CMD-AttachFile", () => {
  it("ST-037: Helper attaches a manual to a machine model", async () => {
    const [lg042, lg043] = await machinesOfOneModel(2);

    const attached = await attach({
      machineId: lg042.machineId,
      attachTo: "machine-model",
      title: "MM Operations Manual",
      fileCategory: "manual",
    });

    expect(attached.ok).toBe(true);
    expect(await filesOf(lg042.museumNumber)).toEqual([{ title: "MM Operations Manual", fileCategory: "manual" }]);
    expect(await filesOf(lg043.museumNumber)).toEqual([{ title: "MM Operations Manual", fileCategory: "manual" }]);
  });

  it("ST-037: Team member attaches a file to a single machine", async () => {
    const [lg042, lg043] = await machinesOfOneModel(2);

    await attach({ machineId: lg042.machineId, title: "LG-042 wiring notes", fileCategory: "other" }, tom);

    expect(await filesOf(lg042.museumNumber)).toEqual([{ title: "LG-042 wiring notes", fileCategory: "other" }]);
    expect(await filesOf(lg043.museumNumber)).toEqual([]);
  });

  it("rejects a file without title, file category or owner itself – whatever form sends it – and one for an unknown machine", async () => {
    const [lg042] = await machinesOfOneModel(1);

    expect(await attach({ machineId: lg042.machineId, title: " " })).toEqual({ ok: false, error: "title-required" });
    expect(await attach({ machineId: lg042.machineId, fileCategory: undefined })).toEqual({
      ok: false,
      error: "file-category-required",
    });
    expect(await attach({ machineId: lg042.machineId, attachTo: undefined })).toEqual({
      ok: false,
      error: "attach-to-required",
    });
    expect(await attach({ machineId: randomUUID() })).toEqual({ ok: false, error: "unknown-machine" });
    expect(await filesOf(lg042.museumNumber)).toEqual([]);
  });

  it("journals the file, its owner and its file category – never the title", async () => {
    const [lg042] = await machinesOfOneModel(1);

    const attached = await attach({ machineId: lg042.machineId, title: "Secret-ish notes", fileCategory: "schematic" });
    if (!attached.ok) throw new Error(attached.error);

    const [entry] = await journalOf(db, { aggregateId: attached.result.fileId });
    expect(entry).toMatchObject({
      type: "EVT-FileAttached",
      aggregate: { type: "AGG-File", id: attached.result.fileId },
      machineId: lg042.machineId,
      actor: anna,
      data: { fileCategory: "schematic", machineModelId: null },
    });
    expect(JSON.stringify(entry.data)).not.toContain("Secret-ish");
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
      await attach({ machineId: lg042.machineId, title, fileCategory });
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

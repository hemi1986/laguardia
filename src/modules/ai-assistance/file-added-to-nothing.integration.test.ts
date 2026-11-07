import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { attachFileCommand, createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { executeCommand } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aiIndexOverview } from ".";
import { aiAssessmentById } from "./ai-assessments";
import { aiAssessmentWork } from "./ai-assessment-work";
import { aiScenario } from "./ai-scenario.test-support";
import { steppingClock } from "./ai-work-stand-in.test-support";
import { fileIndexingWork } from "./file-indexing-work";

/**
 * ST-119: a file added to nothing yet is indexed and paid for like any other (POL-AttachedFileIsIndexedForAi, ADR 0018),
 * but no AI assessment finds it until it is attached. The file is added through CMD-AddFile, as the form "Datei
 * hinzufügen" does it; one run of the background work is driven directly, as the seam catalog names it.
 */
const isolated = isolatedTestDatabase("file_added_to_nothing");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = steppingClock("2026-11-04T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let lg042: string;

afterAll(() => isolated.close());

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
});

const scenario = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });
const seam = scenario.openRouter();
const ai = () => scenario.ai(seam);

beforeEach(async () => {
  await db.execute("DELETE FROM ai_work_hold");
  await db.execute("DELETE FROM ai_assessment");
  await db.execute("DELETE FROM ai_index_item");
  await db.execute("DELETE FROM ai_index_entry");
  await withoutMachines(db);
  clock.set("2026-11-04T10:00:00Z");
  storage = memoryStorage();
  await scenario.turnAiOn({ with: ai() });
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball", technology: "em" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: created.result.machineModelId,
      museumNumber: "LG-042",
      serialNumber: undefined,
      location: "Hall 1",
      machineStatus: "playable",
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  lg042 = registered.result.machineId;
});

describe("a file attached to nothing and the AI (ST-119)", () => {
  it("ST-119: A file attached to nothing is indexed but not found by an AI assessment until attached", async () => {
    const reported = await executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId: lg042,
        description: "Left flipper weak – first seen",
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
    const defect = reported.result.defectId;

    // Given AI is on, a team member adds the PDF "Unsorted manual" attached to nothing.
    const unsorted = await scenario.attachFile(lg042, {
      title: "Unsorted manual",
      bytes: new TextEncoder().encode("Replace the flipper coil of LG-042."),
      contentType: "text/plain",
      to: "nothing",
    });

    // Then it is indexed for AI and counts on the form „KI“, with its cost in the cost of indexing so far.
    expect(await aiIndexOverview(db, ai())).toMatchObject({ indexed: 0, waiting: 1, cost: 0 });
    await scenario.run({ kinds: [fileIndexingWork], with: ai() });
    const indexed = (await aiIndexOverview(db, ai()))!;
    expect(indexed).toMatchObject({ indexed: 1, waiting: 0, failed: [] });
    expect(indexed.cost).toBeGreaterThan(0);

    // And an AI assessment of a defect of "LG-042" does not find it.
    const first = await scenario.requestAiAssessment(defect);
    await scenario.run({ kinds: [aiAssessmentWork], with: ai() });
    const written = (await aiAssessmentById(db, first))!;
    expect(written.state).toBe("written");
    expect(written.filesSearched ?? []).not.toContain(unsorted);

    // After attaching it to "LG-042" a new AI assessment does, without indexing it again.
    const attached = await executeCommand(
      attachFileCommand,
      { fileId: unsorted, machineIds: [lg042], machineModelIds: [] },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!attached.ok) throw new Error(attached.error);
    const second = await scenario.requestAiAssessment(defect);
    await scenario.run({ kinds: [aiAssessmentWork], with: ai() });
    expect((await aiAssessmentById(db, second))!.filesSearched ?? []).toContain(unsorted);
    expect((await aiIndexOverview(db, ai()))!).toMatchObject({ indexed: 1, waiting: 0, cost: indexed.cost });
  });
});

import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  attachFileCommand,
  createMachineModelCommand,
  detachFileCommand,
  fileToOpen,
  registerMachineCommand,
} from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { executeCommand, type CommittedEvent } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { withoutMachines } from "@/modules/collection/machines.test-support";
import { anExistingTeamMember } from "@/test-support/team-members";
import { defectAiAssessments } from ".";
import { aiAssessmentById } from "./ai-assessments";
import { aiAssessmentWork } from "./ai-assessment-work";
import { aiIndexEntryOf } from "./ai-index-entries";
import { writeAiAssessmentForTest } from "./ai-assessment.test-support";
import { aiScenario } from "./ai-scenario.test-support";
import { steppingClock } from "./ai-work-stand-in.test-support";
import { makesAiWork } from "./ai-work-events";
import { fileIndexingWork } from "./file-indexing-work";
import { geminiEmbedding } from "./ai-seam.test-support";

/**
 * ST-115: attaching and detaching are not composed with AI assistance. A new AI assessment reads what the file is
 * attached to when its writing begins (ST-120, ADR 0018); attaching and detaching start no run, cost nothing and leave
 * the AI index as it is; written AI assessments and their references stay. One run of the background work is driven
 * directly, as the seam catalog names it.
 */
const isolated = isolatedTestDatabase("ai_assessment_attachments");
let db: NodePgDatabase;
let storage: MemoryStorage;
const clock = steppingClock("2026-11-03T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let medievalMadness: string;
let eightBall: string;

afterAll(() => isolated.close());

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  medievalMadness = await aModel("Medieval Madness", "Williams", 1997);
  eightBall = await aModel("Eight Ball", "Bally", 1980);
});

beforeEach(async () => {
  await db.execute("DELETE FROM ai_work_hold");
  await db.execute("DELETE FROM ai_assessment");
  await db.execute("DELETE FROM ai_index_item");
  await db.execute("DELETE FROM ai_index_entry");
  await withoutMachines(db);
  clock.set("2026-11-03T10:00:00Z");
  storage = memoryStorage();
  await scenario.turnAiOn({ with: ai() });
});

const scenario = aiScenario({ db: () => db, storage: () => storage, clock, technician: tom });
const seam = scenario.openRouter();
const ai = () => scenario.ai(seam);

async function aModel(title: string, manufacturer: string, year: number): Promise<string> {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer, year: String(year), machineCategory: "pinball", technology: "em" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function aMachine(machineModelId: string, museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function anOpenDefect(machineId: string, title: string): Promise<string> {
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: `${title} – first seen`,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

describe("attach and detach and the AI (ST-115)", () => {
  it("ST-115: A new AI assessment follows attach and detach, at no cost, and written ones stay", async () => {
    const lg042 = await aMachine(medievalMadness, "LG-042");
    const lg050 = await aMachine(eightBall, "LG-050");
    const wiring = await scenario.attachFile(lg042, {
      title: "Wiring notes",
      bytes: new TextEncoder().encode("The wiring of LG-042."),
      contentType: "text/plain",
      to: "machine",
    });
    await scenario.run({ kinds: [fileIndexingWork], with: ai() });
    expect(await aiIndexEntryOf(db, wiring)).toMatchObject({ state: "indexed" });
    const flipper = await anOpenDefect(lg042, "Left flipper weak");
    const display = await anOpenDefect(lg050, "Display flickers");
    // A written AI assessment of the LG-042 defect has a reference to the file.
    const earlier = await scenario.requestAiAssessment(flipper);
    await writeAiAssessmentForTest(db, earlier, {
      summary: "Die Verdrahtung prüfen.",
      references: [{ fileId: wiring, page: 1 }],
      embeddingModel: geminiEmbedding.id,
      at: clock,
    });

    const costBefore = (await aiIndexEntryOf(db, wiring))!.cost;
    const requestsBefore = seam.requests.length;
    const steps = { starts: 0 };
    const afterCommit = (events: readonly CommittedEvent[]) => {
      if (makesAiWork(events)) steps.starts += 1;
    };
    const detached = await executeCommand(
      detachFileCommand,
      { fileId: wiring, target: { machineId: lg042 } },
      { actor: tom, db, clock, newId: randomUUID, afterCommit },
    );
    if (!detached.ok) throw new Error(detached.error);
    const attached = await executeCommand(
      attachFileCommand,
      { fileId: wiring, machineIds: [lg050], machineModelIds: [] },
      { actor: tom, db, clock, newId: randomUUID, afterCommit },
    );
    if (!attached.ok) throw new Error(attached.error);

    // Neither step started a run or a request to OpenRouter, and the cost of indexing so far is unchanged.
    expect(steps.starts).toBe(0);
    expect(seam.requests.length).toBe(requestsBefore);
    expect((await aiIndexEntryOf(db, wiring))!.cost).toBe(costBefore);

    const onFlipper = await scenario.requestAiAssessment(flipper);
    const onDisplay = await scenario.requestAiAssessment(display);
    await scenario.run({ kinds: [aiAssessmentWork], with: ai() });

    // A new AI assessment of the LG-042 defect does not find it, and one of the LG-050 defect does.
    expect((await aiAssessmentById(db, onFlipper))!.filesSearched ?? []).not.toContain(wiring);
    expect((await aiAssessmentById(db, onDisplay))!.filesSearched ?? []).toContain(wiring);

    // The earlier AI assessment still shows its reference, and the file still opens.
    const shown = await defectAiAssessments(db, {
      defectId: flipper,
      viewer: { teamMemberId: tom.teamMemberId, role: "technician" },
      dependencies: ai(),
    });
    const written = [shown.current, ...shown.earlier].find((assessment) => assessment?.id === earlier);
    expect(written?.references).toEqual([
      expect.objectContaining({ fileId: wiring, title: "Wiring notes", removed: false }),
    ]);
    expect(await fileToOpen(db, wiring)).toBeDefined();
  });
});

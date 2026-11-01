import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { memoryAi } from "./ai-seam.test-support";
import { runAiWork, type AiWorkKind } from "./ai-work";
import { standInWork, steppingClock } from "./ai-work-stand-in.test-support";

/**
 * The background work of AI assistance (ST-112, ADR 0015): one run, driven directly through its function with the
 * clock, the budget, the database, the AI seam, the storage seam and the call of the worker route injected – no test
 * waits for a real background run. The kind of work is a stand-in; indexing (ST-106) and AI assessments (ST-107) are
 * the real kinds. A database of its own: the holds of every kind are one set, which a run reads as a whole.
 */
const isolated = isolatedTestDatabase("ai_work");
let db: NodePgDatabase;
const clock = steppingClock("2026-11-02T10:00:00Z");
let standIn: Awaited<ReturnType<typeof standInWork>>;
let calls: number;

beforeAll(async () => {
  db = await isolated.reset();
});
afterAll(() => isolated.close());
beforeEach(async () => {
  await db.execute(sql`DELETE FROM ai_work_hold`);
  clock.set("2026-11-02T10:00:00Z");
  standIn = await standInWork(db, clock);
  calls = 0;
});

function run({ budgetSeconds = 250, kinds = [standIn.kind] }: { budgetSeconds?: number; kinds?: AiWorkKind[] } = {}) {
  return runAiWork({
    db,
    clock,
    budgetSeconds,
    ai: { ai: memoryAi(), encryptionKey: () => undefined },
    storage: memoryStorage(),
    continueWork: async () => {
      calls += 1;
    },
    kinds,
  });
}

describe("a run's budget and its continuation", () => {
  it("stops taking new work once its budget is used, calls the worker route once, and the next run takes the rest", async () => {
    const pieces = await standIn.add(6, { seconds: 3, outcome: "done" });

    await run({ budgetSeconds: 10 });

    expect(standIn.started.map((each) => each.at)).toEqual([
      "2026-11-02T10:00:00.000Z",
      "2026-11-02T10:00:03.000Z",
      "2026-11-02T10:00:06.000Z",
      "2026-11-02T10:00:09.000Z",
    ]);
    expect(calls).toBe(1);

    await run({ budgetSeconds: 10 });

    expect(standIn.started.map((each) => each.id)).toEqual(pieces);
    expect(calls).toBe(1);
    for (const id of pieces) expect(await standIn.stored(id)).toMatchObject({ state: "done", done: 1 });
  });

  it("ends without calling the worker route when no work is left", async () => {
    await run();

    expect(calls).toBe(0);
  });
});

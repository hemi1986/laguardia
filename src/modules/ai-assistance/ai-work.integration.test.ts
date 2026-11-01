import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { memoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { memoryAi } from "./ai-seam.test-support";
import { runAiWork, type AiWorkKind, type HeldPiece } from "./ai-work";
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

/** Starts a run that is cut off while it works on the next piece – like a deployment or the time limit – and never ends. */
async function aRunCutOffAtTheNextPiece(): Promise<void> {
  const started = standIn.nextStart();
  void run();
  await started;
}

describe("holds", () => {
  it("a piece held by a run that was cut off is not taken by another run, neither before nor after its hold ran out", async () => {
    const [piece] = await standIn.add(1, { seconds: 3, outcome: "cut-off" });
    await aRunCutOffAtTheNextPiece();
    standIn.behave(piece, { seconds: 3, outcome: "done" });

    clock.set("2026-11-02T10:08:19Z"); // the hold of 2 × 250 s runs until 10:08:20
    await run();
    clock.set("2026-11-02T10:08:21Z");
    await run();

    expect(standIn.started.map((each) => each.id)).toEqual([piece]);
    expect(await standIn.stored(piece)).toMatchObject({ done: 0 });
  });
});

describe("work that broke off (POL-UnfinishedAiWorkFails)", () => {
  it("the next run records a piece whose hold ran out broken off exactly once, before it takes any waiting piece", async () => {
    const [cutOff] = await standIn.add(1, { seconds: 3, outcome: "cut-off" });
    await aRunCutOffAtTheNextPiece();
    const [waiting] = await standIn.add(1, { seconds: 3, outcome: "done" });
    let brokenOffBeforeTheWaitingPiece: boolean | undefined;
    const nextStart = standIn.nextStart().then(async () => {
      brokenOffBeforeTheWaitingPiece = (await standIn.stored(cutOff)).state === "broken-off";
    });

    clock.set("2026-11-02T10:08:20Z");
    await run();
    await nextStart;
    await run();

    expect(brokenOffBeforeTheWaitingPiece).toBe(true);
    expect(await standIn.stored(cutOff)).toMatchObject({ state: "broken-off", brokenOff: 1, done: 0 });
    expect(await standIn.stored(waiting)).toMatchObject({ state: "done", done: 1 });
    expect(standIn.started.map((each) => each.id)).toEqual([cutOff, waiting]);
  });

  it("two runs starting at the same moment record it broken off once, and no later run takes or records it again", async () => {
    const [cutOff] = await standIn.add(1, { seconds: 3, outcome: "cut-off" });
    await aRunCutOffAtTheNextPiece();
    standIn.behave(cutOff, { seconds: 3, outcome: "done" });

    clock.set("2026-11-02T10:08:20Z");
    await Promise.all([run(), run(), run()]);
    clock.set("2026-11-02T10:30:00Z");
    await run();

    expect(await standIn.stored(cutOff)).toMatchObject({ state: "broken-off", brokenOff: 1, done: 0 });
    expect(standIn.started.map((each) => each.id)).toEqual([cutOff]);
  });

  it("a late result of the cut-off run, after its piece was recorded broken off, stores nothing", async () => {
    const [cutOff] = await standIn.add(1, { seconds: 3, outcome: "cut-off" });
    let late: HeldPiece | undefined;
    const keepsThePiece: AiWorkKind = {
      ...standIn.kind,
      work: async (id, piece) => {
        late = piece;
        await new Promise<never>(() => {});
      },
    };
    const started = new Promise<void>((resolve) => {
      const wait = () => (late ? resolve() : setTimeout(wait, 5));
      wait();
    });
    void run({ kinds: [keepsThePiece] });
    await started;

    clock.set("2026-11-02T10:08:20Z");
    await run();
    const stored = await late!.storeResult((tx) =>
      tx.execute(sql`UPDATE ai_work_stand_in SET state = 'done', done = done + 1 WHERE id = ${cutOff}`),
    );

    expect(stored).toBe("no-longer-held");
    expect(await standIn.stored(cutOff)).toMatchObject({ state: "broken-off", done: 0 });
  });
});

describe("a piece given up on purpose", () => {
  it("is waiting again without a failure, and a later run takes it and does not treat it as broken off", async () => {
    const [piece] = await standIn.add(1, { seconds: 3, outcome: "ai-off" });

    await run();
    standIn.behave(piece, { seconds: 3, outcome: "done" });
    clock.set("2026-11-02T10:30:00Z");
    await run();

    expect(standIn.started.map((each) => each.id)).toEqual([piece, piece]);
    expect(await standIn.stored(piece)).toMatchObject({ state: "done", done: 1, brokenOff: 0 });
  });

  it("does not make the run call the worker route again for the piece it gave up", async () => {
    await standIn.add(1, { seconds: 3, outcome: "ai-off" });

    await run({ budgetSeconds: 10 });

    expect(standIn.started).toHaveLength(1);
    expect(calls).toBe(0);
  });
});

import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { ContentStorage } from "@/platform/storage";
import type { AiDependencies } from "./ai-settings";
import { aiWorkHold } from "./schema";

/**
 * The background work of AI assistance (ST-112, ADR 0015). A run asks the database what is left, holds one piece of
 * work at a time – a whole file or a whole AI assessment – does it outside any transaction and stores its result in
 * the short transaction that ends the hold. It stops taking new work once its budget is used and, if work is left,
 * calls the worker route again before it ends. Nothing is retried by itself.
 */

/** What a kind of work gets to do its work: the run's database, clock and seams. */
export type AiWorkContext = {
  db: NodePgDatabase;
  clock: Clock;
  ai: AiDependencies;
  storage: ContentStorage;
};

/** A piece of work the run holds – the only way a kind stores a result or gives a piece up. */
export type HeldPiece = {
  /**
   * Stores the piece's result only while the run still holds it – in the transaction that ends the hold. A late
   * result, after the hold ran out or the piece was recorded broken off, stores nothing.
   */
  storeResult(store: (tx: Database) => Promise<unknown>): Promise<"stored" | "no-longer-held">;
  /** Ends the hold without a result and without a failure (AI turned off meanwhile): the piece is waiting again. */
  giveUp(): Promise<void>;
};

/**
 * A kind of work (indexing a file – ST-106, writing an AI assessment – ST-107). A run takes the kinds in the order it
 * is given them, so a kind earlier in the list always goes first.
 */
export type AiWorkKind = {
  /** Names the kind in its holds – fixed once a hold of it may exist. */
  kind: string;
  /** The IDs of the pieces of this kind left to do, in the order to take them – holds play no part. */
  waiting(db: Database, context: AiWorkContext): Promise<string[]>;
  /** Whether the piece is still left to do – asked again once it is held, so a piece done meanwhile is not taken. */
  isWaiting(tx: Database, id: string, context: AiWorkContext): Promise<boolean>;
  /** Does the piece – the slow part, outside any transaction – and ends with `storeResult` or `giveUp`. */
  work(id: string, piece: HeldPiece, context: AiWorkContext): Promise<void>;
  /** POL-UnfinishedAiWorkFails: records the piece failed as *broken off*, through the aggregate's own command. */
  recordBrokenOff(tx: Database, id: string, context: AiWorkContext): Promise<void>;
};

export type AiWorkDependencies = AiWorkContext & {
  /** How long a run may take new work (a setting – about 250 s on Vercel Hobby, far more on a server of its own). */
  budgetSeconds: number;
  /** Calls the worker route, so the next run takes what is left. */
  continueWork: () => Promise<void>;
  kinds: readonly AiWorkKind[];
};

/** A hold lasts twice the budget: a piece expected to fit one budget, taken just before the budget ends, still ends in it. */
export function holdSeconds(budgetSeconds: number): number {
  return 2 * budgetSeconds;
}

const secondsAfter = (instant: Date, seconds: number) => new Date(instant.getTime() + seconds * 1000);

/** One run of the AI work. */
export async function runAiWork(dependencies: AiWorkDependencies): Promise<void> {
  const { clock, budgetSeconds, kinds } = dependencies;
  const runId = randomUUID();
  const budgetEnds = secondsAfter(clock.now(), budgetSeconds);
  while (await failOneBrokenOff(dependencies));
  while (clock.now() < budgetEnds) {
    const taken = await takeNext(dependencies, runId);
    if (!taken) return;
    await taken.kind.work(taken.id, heldPiece(dependencies, runId, taken.kind.kind, taken.id), dependencies);
  }
  if (await anyWaiting(dependencies, kinds)) await dependencies.continueWork();
}

/**
 * POL-UnfinishedAiWorkFails (EVT-AiWorkLeftUnfinished, derived): one piece whose hold ran out without a result is
 * handed to its kind's broken-off recording, and the hold is dropped in the same transaction. `SKIP LOCKED` lets runs
 * started at the same moment share them, so each piece is recorded exactly once. False when there is none left.
 */
async function failOneBrokenOff(dependencies: AiWorkDependencies): Promise<boolean> {
  const { db, clock, kinds } = dependencies;
  return db.transaction(async (tx) => {
    const [ranOut] = await tx
      .select({ kind: aiWorkHold.kind, pieceId: aiWorkHold.pieceId })
      .from(aiWorkHold)
      .where(lte(aiWorkHold.heldUntil, clock.now()))
      .orderBy(asc(aiWorkHold.heldUntil))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!ranOut) return false;
    const kind = kinds.find((each) => each.kind === ranOut.kind);
    if (kind) await kind.recordBrokenOff(tx, ranOut.pieceId, dependencies);
    // A hold of a kind this deployment does not know cannot be recorded – it is dropped, never kept for ever.
    else console.error(`AI work: a hold of the unknown kind "${ranOut.kind}" is dropped`);
    await tx
      .delete(aiWorkHold)
      .where(and(eq(aiWorkHold.kind, ranOut.kind), eq(aiWorkHold.pieceId, ranOut.pieceId)));
    return true;
  });
}

async function takeNext(dependencies: AiWorkDependencies, runId: string) {
  const { db, clock, budgetSeconds, kinds } = dependencies;
  for (const kind of kinds) {
    for (const id of await kind.waiting(db, dependencies)) {
      const taken = await db.transaction(async (tx) => {
        const held = await tx
          .insert(aiWorkHold)
          .values({
            kind: kind.kind,
            pieceId: id,
            heldBy: runId,
            heldUntil: secondsAfter(clock.now(), holdSeconds(budgetSeconds)),
          })
          .onConflictDoNothing()
          .returning({ pieceId: aiWorkHold.pieceId });
        if (held.length === 0) return false;
        if (await kind.isWaiting(tx, id, dependencies)) return true;
        // Done or recorded broken off meanwhile – the hold just taken is dropped again.
        await tx.delete(aiWorkHold).where(and(eq(aiWorkHold.kind, kind.kind), eq(aiWorkHold.pieceId, id)));
        return false;
      });
      if (taken) return { kind, id };
    }
  }
  return undefined;
}

async function anyWaiting(dependencies: AiWorkDependencies, kinds: readonly AiWorkKind[]): Promise<boolean> {
  for (const kind of kinds) if ((await kind.waiting(dependencies.db, dependencies)).length > 0) return true;
  return false;
}

function heldPiece(dependencies: AiWorkDependencies, runId: string, kind: string, id: string): HeldPiece {
  const { db, clock } = dependencies;
  const thisHold = and(eq(aiWorkHold.kind, kind), eq(aiWorkHold.pieceId, id), eq(aiWorkHold.heldBy, runId));
  return {
    storeResult: (store) =>
      db.transaction(async (tx) => {
        const ended = await tx
          .delete(aiWorkHold)
          .where(and(thisHold, gt(aiWorkHold.heldUntil, clock.now())))
          .returning({ pieceId: aiWorkHold.pieceId });
        if (ended.length === 0) return "no-longer-held";
        await store(tx);
        return "stored";
      }),
    giveUp: async () => {
      await db.delete(aiWorkHold).where(thisHold);
    },
  };
}

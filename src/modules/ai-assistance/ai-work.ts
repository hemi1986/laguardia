import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lte, notInArray } from "drizzle-orm";
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
  const { clock, budgetSeconds } = dependencies;
  const run: Run = { id: randomUUID(), givenUp: new Set(), notRecorded: [] };
  const budgetEnds = secondsAfter(clock.now(), budgetSeconds);
  while (await failOneBrokenOff(dependencies, run));
  while (clock.now() < budgetEnds) {
    const taken = await takeNext(dependencies, run);
    if (!taken) return;
    await workOn(dependencies, run, taken.kind, taken.id);
  }
  if (await anyWaiting(dependencies, run)) await dependencies.continueWork();
}

/**
 * Works on one held piece. A kind that throws is a bug or an outage the kind did not turn into a failure of its own:
 * the hold stays, so the piece is recorded broken off once its hold has run out, and the run goes on. Logged by kind
 * and ID only – never what the piece holds.
 */
async function workOn(dependencies: AiWorkDependencies, run: Run, kind: AiWorkKind, id: string): Promise<void> {
  try {
    await kind.work(id, heldPiece(dependencies, run, kind.kind, id), dependencies);
  } catch (error) {
    console.error(`AI work: ${kind.kind} ${id} ended without a result:`, error instanceof Error ? error.name : error);
  }
}

/**
 * This run: the ID its holds carry, the pieces it gave up – it never takes those again – and the broken-off pieces
 * whose recording threw, which it does not try again.
 */
type Run = { id: string; givenUp: Set<string>; notRecorded: string[] };

const pieceKey = (kind: string, id: string) => `${kind}:${id}`;

async function waitingFor(dependencies: AiWorkDependencies, run: Run, kind: AiWorkKind): Promise<string[]> {
  const waiting = await kind.waiting(dependencies.db, dependencies);
  return waiting.filter((id) => !run.givenUp.has(pieceKey(kind.kind, id)));
}

/**
 * POL-UnfinishedAiWorkFails (EVT-AiWorkLeftUnfinished, derived): one piece whose hold ran out without a result is
 * handed to its kind's broken-off recording, and the hold is dropped in the same transaction. `SKIP LOCKED` lets runs
 * started at the same moment share them, so each piece is recorded exactly once. A recording that throws rolls its
 * transaction back: the hold stays – so the piece is never taken again – the run logs it, skips it and goes on, and the
 * next run tries to record it again. False when there is none left.
 */
async function failOneBrokenOff(dependencies: AiWorkDependencies, run: Run): Promise<boolean> {
  const { db, clock, kinds } = dependencies;
  let found: { kind: string; pieceId: string } | undefined;
  try {
    return await db.transaction(async (tx) => {
      const [ranOut] = await tx
        .select({ kind: aiWorkHold.kind, pieceId: aiWorkHold.pieceId })
        .from(aiWorkHold)
        .where(
          and(
            lte(aiWorkHold.heldUntil, clock.now()),
            run.notRecorded.length > 0 ? notInArray(aiWorkHold.pieceId, run.notRecorded) : undefined,
          ),
        )
        .orderBy(asc(aiWorkHold.heldUntil))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!ranOut) return false;
      found = ranOut;
      const kind = kinds.find((each) => each.kind === ranOut.kind);
      if (kind) await kind.recordBrokenOff(tx, ranOut.pieceId, dependencies);
      // A hold of a kind this deployment does not know cannot be recorded – it is dropped, never kept for ever.
      else console.error(`AI work: a hold of the unknown kind "${ranOut.kind}" is dropped`);
      await tx
        .delete(aiWorkHold)
        .where(and(eq(aiWorkHold.kind, ranOut.kind), eq(aiWorkHold.pieceId, ranOut.pieceId)));
      return true;
    });
  } catch (error) {
    if (!found) throw error;
    run.notRecorded.push(found.pieceId);
    console.error(
      `AI work: ${found.kind} ${found.pieceId} could not be recorded broken off:`,
      error instanceof Error ? error.name : error,
    );
    return true;
  }
}

async function takeNext(dependencies: AiWorkDependencies, run: Run) {
  const { db, clock, budgetSeconds, kinds } = dependencies;
  for (const kind of kinds) {
    for (const id of await waitingFor(dependencies, run, kind)) {
      const taken = await db.transaction(async (tx) => {
        const held = await tx
          .insert(aiWorkHold)
          .values({
            kind: kind.kind,
            pieceId: id,
            heldBy: run.id,
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

async function anyWaiting(dependencies: AiWorkDependencies, run: Run): Promise<boolean> {
  for (const kind of dependencies.kinds) if ((await waitingFor(dependencies, run, kind)).length > 0) return true;
  return false;
}

function heldPiece(dependencies: AiWorkDependencies, run: Run, kind: string, id: string): HeldPiece {
  const { db, clock } = dependencies;
  const thisHold = and(eq(aiWorkHold.kind, kind), eq(aiWorkHold.pieceId, id), eq(aiWorkHold.heldBy, run.id));
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
      run.givenUp.add(pieceKey(kind, id));
      await db.delete(aiWorkHold).where(thisHold);
    },
  };
}

/**
 * Whether a piece of this kind – or of these pieces – was left unfinished (EVT-AiWorkLeftUnfinished, derived): its
 * hold ran out without a result and no run has recorded it broken off yet. A page that shows such work (the defect
 * page, ST-108; the form „KI“, ST-109) starts a run only then, so refreshing it never starts work on every load.
 */
export async function aiWorkLeftUnfinished(
  db: Database,
  clock: Clock,
  kind: string,
  pieceIds?: readonly string[],
): Promise<boolean> {
  if (pieceIds?.length === 0) return false;
  const [found] = await db
    .select({ pieceId: aiWorkHold.pieceId })
    .from(aiWorkHold)
    .where(
      and(
        eq(aiWorkHold.kind, kind),
        lte(aiWorkHold.heldUntil, clock.now()),
        pieceIds ? inArray(aiWorkHold.pieceId, [...pieceIds]) : undefined,
      ),
    )
    .limit(1);
  return !!found;
}

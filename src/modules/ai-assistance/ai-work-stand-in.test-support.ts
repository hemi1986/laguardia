import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Clock } from "@/platform/clock";
import type { AiWorkKind } from "./ai-work";

/**
 * A stand-in kind of AI work (ST-112) – the mechanism of the background work proven without indexing or AI
 * assessments, which are the real kinds of ST-106 and ST-107. A stand-in piece is a row of its own table, created in
 * the test's isolated database; what it does when a run works on it is set per piece:
 * - `done` – takes `seconds` on the run's clock, then stores its result;
 * - `ai-off` – gives the piece up on purpose, as a real kind does when AI was turned off meanwhile;
 * - `cut-off` – never ends, like a run killed by a deployment or the time limit; the run never comes back.
 */
export type StandInBehaviour = { seconds: number; outcome: "done" | "ai-off" | "cut-off" };

/** A clock the stand-in moves forward while it works – a run's budget is measured on it. */
export type SteppingClock = Clock & { advance(seconds: number): void; set(at: string): void };

export function steppingClock(at: string): SteppingClock {
  let now = new Date(at).getTime();
  return {
    now: () => new Date(now),
    advance: (seconds) => {
      now += seconds * 1000;
    },
    set: (instant) => {
      now = new Date(instant).getTime();
    },
  };
}

type StoredStandIn = { id: string; state: "waiting" | "done" | "broken-off"; done: number; brokenOff: number };

export async function standInWork(db: NodePgDatabase, clock: SteppingClock) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_work_stand_in (
      id uuid PRIMARY KEY,
      position bigserial,
      state text NOT NULL DEFAULT 'waiting',
      done integer NOT NULL DEFAULT 0,
      broken_off integer NOT NULL DEFAULT 0
    )`);
  await db.execute(sql`TRUNCATE ai_work_stand_in`);
  const behaviours = new Map<string, StandInBehaviour>();
  /** The pieces a run started, in order, with the time on the clock when it started each. */
  const started: { id: string; at: string }[] = [];
  const startedListeners: (() => void)[] = [];

  const kind: AiWorkKind = {
    kind: "stand-in",
    async waiting(tx) {
      const { rows } = await tx.execute<{ id: string }>(
        sql`SELECT id FROM ai_work_stand_in WHERE state = 'waiting' ORDER BY position`,
      );
      return rows.map((row) => row.id);
    },
    async isWaiting(tx, id) {
      const { rows } = await tx.execute(sql`SELECT 1 FROM ai_work_stand_in WHERE id = ${id} AND state = 'waiting'`);
      return rows.length > 0;
    },
    async work(id, piece) {
      const behaviour = behaviours.get(id) ?? { seconds: 1, outcome: "done" };
      started.push({ id, at: clock.now().toISOString() });
      startedListeners.splice(0).forEach((listener) => listener());
      if (behaviour.outcome === "cut-off") return new Promise<never>(() => {});
      clock.advance(behaviour.seconds);
      if (behaviour.outcome === "ai-off") return piece.giveUp();
      await piece.storeResult((tx) =>
        tx.execute(sql`UPDATE ai_work_stand_in SET state = 'done', done = done + 1 WHERE id = ${id}`),
      );
    },
    async recordBrokenOff(tx, id) {
      await tx.execute(
        sql`UPDATE ai_work_stand_in SET state = 'broken-off', broken_off = broken_off + 1 WHERE id = ${id}`,
      );
    },
  };

  return {
    kind,
    started,
    /** Resolves when a run has started the next piece. */
    nextStart: () => new Promise<void>((resolve) => startedListeners.push(resolve)),
    /** Adds waiting pieces, in order. */
    async add(count: number, behaviour: StandInBehaviour = { seconds: 1, outcome: "done" }): Promise<string[]> {
      const ids = Array.from({ length: count }, () => randomUUID());
      for (const id of ids) {
        behaviours.set(id, behaviour);
        await db.execute(sql`INSERT INTO ai_work_stand_in (id) VALUES (${id})`);
      }
      return ids;
    },
    /** From now on, the piece behaves like this when a run works on it. */
    behave(id: string, behaviour: StandInBehaviour) {
      behaviours.set(id, behaviour);
    },
    async stored(id: string): Promise<StoredStandIn> {
      const { rows } = await db.execute<{
        id: string;
        state: StoredStandIn["state"];
        done: number;
        broken_off: number;
      }>(sql`SELECT id, state, done, broken_off FROM ai_work_stand_in WHERE id = ${id}`);
      const [row] = rows;
      return { id: row.id, state: row.state, done: row.done, brokenOff: row.broken_off };
    },
  };
}

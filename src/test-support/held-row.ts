import { sql, type SQL } from "drizzle-orm";
import type { Database } from "@/platform/command";

/**
 * For tests of two transactions racing for one row: holds the row in a transaction of its own while `race` starts
 * the racers, then lets go – also when `race` throws. `race` gets `untilWaiting(count)`, which waits until that many
 * sessions are blocked by the holding transaction, directly or behind one another. Only those count: other tests use
 * the same database at the same time, and their lock waits must neither let a racer start early nor end the wait.
 *
 * `race` returns what the test awaits afterwards – wrapped in an object, because the racers finish only once the row
 * is let go. Two sessions waiting for the same row are served by PostgreSQL in the order they arrived (its lock queue),
 * so the racer started first, and seen waiting, saves first.
 */
export async function whileHoldingRow<Racing extends object>(
  db: Database,
  lockRow: SQL,
  race: (untilWaiting: (count: number) => Promise<void>) => Promise<Racing>,
): Promise<Racing> {
  let held!: (pid: number) => void;
  let failedToHold!: (reason: unknown) => void;
  const holderPid = new Promise<number>((resolve, reject) => ((held = resolve), (failedToHold = reject)));
  let letGo!: () => void;
  const released = new Promise<void>((resolve) => (letGo = resolve));
  const holding = db
    .transaction(async (tx) => {
      const { rows } = await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
      await tx.execute(lockRow);
      held(rows[0].pid);
      await released;
    })
    .catch(failedToHold);
  try {
    const holder = await holderPid;
    return await race(async (count) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const { rows } = await db.execute<{ waiting: number }>(sql`
          WITH RECURSIVE blocked(pid) AS (
            SELECT pid FROM pg_stat_activity WHERE ${holder} = ANY(pg_blocking_pids(pid))
            UNION
            SELECT waiter.pid FROM pg_stat_activity waiter JOIN blocked ON blocked.pid = ANY(pg_blocking_pids(waiter.pid))
          )
          SELECT count(*)::int AS waiting FROM blocked`);
        if (rows[0].waiting >= count) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`never saw ${count} sessions waiting for the held row`);
    });
  } finally {
    letGo();
    await holding;
  }
}

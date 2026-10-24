import { and, eq } from "drizzle-orm";
import type { Clock } from "@/platform/clock";
import type { Database, TeamMemberId } from "@/platform/command";
import { dashboardVisit } from "./schema";
import { decideVisit, type StoredVisit } from "./visit";

async function storedVisit(db: Database, teamMemberId: TeamMemberId): Promise<StoredVisit | undefined> {
  const [row] = await db
    .select({ currentVisitStartedAt: dashboardVisit.currentVisitStartedAt, lastVisit: dashboardVisit.lastVisit })
    .from(dashboardVisit)
    .where(eq(dashboardVisit.teamMemberId, teamMemberId));
  return row;
}

/**
 * Records that the team member opened their dashboard now (ADR 0011) – the only writer of the Last visit, called from
 * the dashboard's client effect, never from its render. Idempotent within one visit: it writes only when a visit
 * begins, and only over the visit it read – so a second tab opening at the same moment changes nothing twice.
 */
export async function recordVisit(db: Database, clock: Clock, teamMemberId: TeamMemberId): Promise<void> {
  const stored = await storedVisit(db, teamMemberId);
  const { visit, changed } = decideVisit(stored, clock.now());
  if (!changed) return;
  if (!stored) {
    await db
      .insert(dashboardVisit)
      .values({ teamMemberId, ...visit })
      .onConflictDoNothing();
    return;
  }
  await db
    .update(dashboardVisit)
    .set(visit)
    .where(
      and(
        eq(dashboardVisit.teamMemberId, teamMemberId),
        eq(dashboardVisit.currentVisitStartedAt, stored.currentVisitStartedAt),
      ),
    );
}

/**
 * The Last visit the dashboard marks against when it is opened now – computed with the recorder's own rule, writing
 * nothing (ADR 0011), so a prefetch or the re-render after an action shows the same marks. Never visited: now, so
 * nothing is marked.
 */
export async function lastVisitOf(db: Database, clock: Clock, teamMemberId: TeamMemberId): Promise<Date> {
  return decideVisit(await storedVisit(db, teamMemberId), clock.now()).visit.lastVisit;
}

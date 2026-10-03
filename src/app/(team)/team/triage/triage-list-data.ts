import { machineLabels } from "@/modules/collection";
import { triageList, type TriageListEntry } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { elapsedHours, elapsedMoreThanHours } from "@/platform/time";

/** Waiting longer than 3 days: more than 72 hours since it was reported (HS-2, time convention ST-003). */
const LONG_WAIT_HOURS = 72;

/** Who reported a problem, as the team sees it: a visitor, or a team member by name. */
export type ShownReporter = { kind: "visitor" } | { kind: "team-member"; name: string | undefined };

/** One entry of the triage list as the page shows it (RM-TriageList, ST-017). */
export type TriageListItem = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  description: string;
  reporter: ShownReporter;
  reportedAt: Date;
  waitingHours: number;
  waitingLong: boolean;
};

/**
 * The triage list's data: Repair's untriaged problem reports with Collection's museum numbers and titles and Team's
 * names – the page composes the modules' public queries (ST-009). The waiting time is computed when the page loads.
 */
export async function loadTriageList(db: Database, clock: Clock): Promise<{ entries: TriageListItem[] }> {
  const entries = await triageList(db);
  return { entries: await shown(db, clock, entries) };
}

/** The entries with machine and reporter by name, and how long each has been waiting. */
export async function shown(db: Database, clock: Clock, entries: TriageListEntry[]): Promise<TriageListItem[]> {
  const [machines, names] = await Promise.all([
    machineLabels(
      db,
      entries.map((entry) => entry.machineId),
    ),
    teamMemberNames(
      db,
      entries.flatMap((entry) => (entry.reporter.kind === "team-member" ? [entry.reporter.teamMemberId] : [])),
    ),
  ]);
  const now = clock.now();
  return entries.map((entry) => ({
    id: entry.id,
    museumNumber: machines.get(entry.machineId)?.museumNumber ?? "",
    machineModelTitle: machines.get(entry.machineId)?.machineModelTitle ?? "",
    description: entry.description,
    reporter:
      entry.reporter.kind === "visitor"
        ? { kind: "visitor" }
        : { kind: "team-member", name: names.get(entry.reporter.teamMemberId) },
    reportedAt: entry.reportedAt,
    waitingHours: elapsedHours(entry.reportedAt, now),
    waitingLong: elapsedMoreThanHours(entry.reportedAt, now, LONG_WAIT_HOURS),
  }));
}

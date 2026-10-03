import { machineLabels } from "@/modules/collection";
import { triageList, type TriageListEntry } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";

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
 * names – the page composes the modules' public queries (ST-009). Repair computes the waiting time when the page loads.
 */
export async function loadTriageList(db: Database, clock: Clock): Promise<{ entries: TriageListItem[] }> {
  return { entries: await withNames(db, await triageList(db, clock)) };
}

/** Problem reports of the triage list with their machine's museum number and title and the reporter's name. */
export async function withNames(db: Database, entries: TriageListEntry[]): Promise<TriageListItem[]> {
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
    waitingHours: entry.waitingHours,
    waitingLong: entry.waitingLong,
  }));
}

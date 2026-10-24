import { and, eq, inArray } from "drizzle-orm";
import type { Clock } from "@/platform/clock";
import { readJournal, type CatalogueEntry, type Database, type TeamMemberId } from "@/platform/command";
import { hoursBefore } from "@/platform/time";
import { repairEvents } from "./events";
import { defect } from "./schema";

/** One change by someone else on a defect the team member claimed (ST-086, G25) – who by ID; the page names them. */
export type ClaimedDefectChange =
  | { kind: "taken-over"; by: string; at: Date }
  | { kind: "assigned"; by: string; to: string; at: Date }
  | { kind: "released"; by: string; at: Date };

/** A defect the team member claims, or one that left them in the last 7 days, with what others changed since their claim. */
export type ClaimedDefectChanges = {
  defectId: string;
  machineId: string;
  title: string;
  /** When it left them – taken over, assigned to someone else, released or resolved by someone else; none while they claim it. */
  leftAt: Date | undefined;
  /** Newest first. */
  changes: ClaimedDefectChange[];
};

/** A defect that left its claimant stays listed for 7 days – 168 hours, as on the technician dashboard (ST-058). */
const LEFT_HOURS = 168;

/** The journal entries that start or end a claim, or change something on the claimed defect. */
const TRACKED = ["EVT-DefectClaimed", "EVT-DefectClaimReleased"] as const;

type Entry = CatalogueEntry<(typeof repairEvents)["entries"], (typeof TRACKED)[number]>;

/**
 * What changed on the defects a team member claimed (RM-HelperDashboard, ST-086) – read from the event journal: every
 * change by someone else since their latest claim, and a defect that left them, with the change that made it leave, for
 * 7 days. Their own actions are never a change (G25). The defects in no particular order – the page orders them.
 */
export async function changesOnClaimedDefects(
  db: Database,
  clock: Clock,
  teamMemberId: TeamMemberId,
): Promise<ClaimedDefectChanges[]> {
  const since = hoursBefore(clock.now(), LEFT_HOURS);
  const [claimed, leaving] = await Promise.all([
    db
      .select({ id: defect.id })
      .from(defect)
      .where(and(eq(defect.state, "open"), eq(defect.claimedBy, teamMemberId))),
    readJournal(db, repairEvents, {
      types: ["EVT-DefectClaimed", "EVT-DefectClaimReleased"],
      since,
      notBy: teamMemberId,
    }),
  ]);
  const ids = [
    ...new Set([
      ...claimed.map((row) => row.id),
      ...leaving.filter((entry) => leftThem(entry, teamMemberId)).map((entry) => entry.aggregate.id),
    ]),
  ];
  if (ids.length === 0) return [];
  const [defects, entries] = await Promise.all([
    db
      .select({ id: defect.id, machineId: defect.machineId, title: defect.title })
      .from(defect)
      .where(inArray(defect.id, ids)),
    readJournal(db, repairEvents, { types: TRACKED, aggregateIds: ids }),
  ]);
  return defects.flatMap((shown) => {
    const changes = changesSinceClaim(
      entries.filter((entry) => entry.aggregate.id === shown.id),
      teamMemberId,
    );
    if (!changes || (changes.leftAt && changes.leftAt < since)) return [];
    return [{ defectId: shown.id, machineId: shown.machineId, title: shown.title, ...changes }];
  });
}

/**
 * The changes by others on one defect since the team member's latest claim, oldest entry first in – or nothing when the
 * defect is not theirs: never claimed, or left them by their own doing.
 */
function changesSinceClaim(
  entries: readonly Entry[],
  teamMemberId: TeamMemberId,
): Pick<ClaimedDefectChanges, "leftAt" | "changes"> | undefined {
  let mine = false;
  let leftAt: Date | undefined;
  let changes: ClaimedDefectChange[] = [];
  /** The claim ends – by someone else's change, which stays listed, or by their own doing, which is not listed at all. */
  const leave = (change: ClaimedDefectChange | undefined, at: Date) => {
    mine = false;
    leftAt = change ? at : undefined;
    if (change) changes.push(change);
  };
  for (const entry of entries) {
    const at = entry.occurredAt;
    const by = entry.actor.kind === "team-member" ? entry.actor.teamMemberId : undefined;
    switch (entry.type) {
      case "EVT-DefectClaimed": {
        const { claimedBy, assignedBy } = entry.data;
        if (claimedBy === teamMemberId) {
          mine = true;
          leftAt = undefined;
          changes = [];
        } else if (mine && claimedBy) {
          leave(
            assignedBy
              ? { kind: "assigned", by: assignedBy, to: claimedBy, at }
              : { kind: "taken-over", by: claimedBy, at },
            at,
          );
        }
        break;
      }
      case "EVT-DefectClaimReleased":
        if (mine) leave(by && by !== teamMemberId ? { kind: "released", by, at } : undefined, at);
        break;
    }
  }
  if (!mine && !leftAt) return undefined;
  return { leftAt, changes: changes.reverse() };
}

/** Whether the entry is someone else ending the team member's claim. */
function leftThem(entry: Entry, teamMemberId: TeamMemberId): boolean {
  switch (entry.type) {
    case "EVT-DefectClaimed":
      return entry.data.takenOverFrom === teamMemberId;
    case "EVT-DefectClaimReleased":
      return entry.data.formerClaimant === teamMemberId;
  }
}

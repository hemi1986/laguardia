import { machineRecord, type MachineRecord, type Retirement, type StatusChange } from "@/modules/collection";
import { openDefects, repairHistory, type RepairHistoryEntry } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import { systemClock, type Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../claimant";
import { shownOpenDefects, type OpenDefectsItem } from "../../defects/open-defects-data";

/** A status change as the machine record shows it: who changed it by name, not by ID. */
export type NamedStatusChange = Omit<StatusChange, "changedBy"> & { changedBy: string | undefined };

/** The machine record with names – what the page shows (ST-009). */
export type MachineRecordData = Omit<MachineRecord, "statusHistory" | "retirement"> & {
  statusHistory: NamedStatusChange[];
  retirement?: Omit<Retirement, "retiredBy"> & { retiredBy: string | undefined };
  /** Section 4 (ST-033): its open defects, as the open defects list shows them – high priority first. */
  openDefects: OpenDefectsItem[];
  /** Section 7 (ST-033): its most recent repairs, the most recently ended first – at most `RECENT_REPAIRS`. */
  recentRepairs: Repair[];
  /** How many entries its whole repair history has – open defects included (ST-033). */
  repairHistoryCount: number;
};

/** How many of the most recent repairs the machine record shows (user, 2026-10-14, `/implement ST-033`). */
export const RECENT_REPAIRS = 3;

/**
 * A repair that has ended, as section 7 shows it: a resolved defect with its closing note, or a problem report resolved
 * on the spot with its note – who ended it by name, and when.
 */
export type Repair = {
  kind: "defect" | "resolved-on-the-spot";
  /** The defect's or the problem report's ID. */
  id: string;
  /** The defect's title, or the problem report's description. */
  title: string | undefined;
  /** The closing note, or the note of the resolution on the spot. */
  note: string;
  resolvedBy: string | undefined;
  resolvedAt: Date;
};

/**
 * The page's data: the Collection module's machine record, with the team members' names from the Team module, and the
 * Repair module's open defects and repair history (ST-033). The first read across two modules (ST-009): neither module
 * imports the other – the page composes their public queries. `clock` makes "open for … days" (ST-021); `viewer` is the
 * team member looking at the page – one's own claim is said as such (ST-025).
 */
export async function loadMachineRecord(
  db: Database,
  museumNumber: string,
  { clock = systemClock, viewer }: { clock?: Clock; viewer?: Viewer } = {},
): Promise<MachineRecordData | undefined> {
  const record = await machineRecord(db, museumNumber);
  if (!record) return undefined;
  const [open, history] = await Promise.all([openDefects(db, { machineId: record.id }), repairHistory(db, record.id)]);
  const recent = history.flatMap(endedRepair).sort((a, b) => b.resolvedAt.getTime() - a.resolvedAt.getTime());
  const shown = recent.slice(0, RECENT_REPAIRS);
  const ids = [
    ...record.statusHistory.map((change) => change.changedBy),
    record.retirement?.retiredBy,
    ...shown.map((repair) => repair.resolvedBy),
  ];
  const [names, shownOpen] = await Promise.all([
    teamMemberNames(
      db,
      ids.filter((id): id is string => id !== undefined),
    ),
    shownOpenDefects(db, clock, open, viewer),
  ]);
  return {
    ...record,
    statusHistory: record.statusHistory.map((change) => ({ ...change, changedBy: names.get(change.changedBy) })),
    retirement: record.retirement && { ...record.retirement, retiredBy: names.get(record.retirement.retiredBy) },
    openDefects: shownOpen,
    recentRepairs: shown.map((repair) => ({ ...repair, resolvedBy: names.get(repair.resolvedBy) })),
    repairHistoryCount: history.length,
  };
}

/** An entry of the repair history as a repair that has ended – none while its defect is open. Who ended it by ID. */
function endedRepair(entry: RepairHistoryEntry): (Omit<Repair, "resolvedBy"> & { resolvedBy: string })[] {
  if (entry.kind === "resolved-on-the-spot") {
    const { id, description, note, resolvedBy, resolvedAt } = entry;
    return [{ kind: entry.kind, id, title: description, note, resolvedBy, resolvedAt }];
  }
  const latest = entry.resolutions.at(-1);
  if (entry.state !== "resolved" || !latest) return [];
  return [
    {
      kind: "defect",
      id: entry.id,
      title: entry.title,
      note: latest.closingNote,
      resolvedBy: latest.resolvedBy,
      resolvedAt: latest.resolvedAt,
    },
  ];
}

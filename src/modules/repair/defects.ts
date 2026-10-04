import { and, asc, eq, sql } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import type { Defect, Priority } from "./defect";
import { defect } from "./schema";

/** How AGG-Defect is stored (ST-018): one row per defect, versioned (HS-16). */
export const defects = aggregateStore({
  type: "AGG-Defect",
  table: defect,
  toState: (row): Defect => ({
    id: row.id,
    machineId: row.machineId,
    problemReportId: row.problemReportId,
    title: row.title,
    priority: row.priority,
    suitableForHelpers: row.suitableForHelpers,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt,
    state: row.state,
  }),
  toRow: (state: Defect) => ({ ...state }),
});

/**
 * The titles of a machine's open defects, the oldest first – what the visitor machine page shows (RM-VisitorMachinePage,
 * ST-018): written by a technician to be understood by visitors, shown untranslated.
 */
export async function openDefectTitles(db: Database, machineId: string): Promise<string[]> {
  const rows = await db
    .select({ title: defect.title })
    .from(defect)
    .where(and(eq(defect.machineId, machineId), eq(defect.state, "open")))
    .orderBy(asc(defect.recordedAt), asc(defect.id));
  return rows.map((row) => row.title);
}

/** A defect's title and machine – for the confirmation after recording it (ST-018, G3). */
export async function defectTitle(
  db: Database,
  defectId: string,
): Promise<{ title: string; machineId: string } | undefined> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(defectId)) return undefined;
  const [row] = await db
    .select({ title: defect.title, machineId: defect.machineId })
    .from(defect)
    .where(eq(defect.id, defectId));
  return row;
}

/** One open defect as the open defects list shows it (RM-OpenDefects, ST-021) – its machine by ID; the page names it. */
export type OpenDefect = {
  id: string;
  machineId: string;
  title: string;
  priority: Priority;
  suitableForHelpers: boolean;
  /** When it was recorded – it has been open since then (data model: Recorded at). */
  openSince: Date;
};

/** High first, then normal, then low (ST-021). */
const priorityRank = sql`CASE ${defect.priority} WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`;

/**
 * RM-OpenDefects (ST-021): every open defect, by priority – high first –, within a priority the oldest first. Claim,
 * hold, work log and linked problem reports follow with ST-022, ST-024, ST-025 and ST-029.
 */
export async function openDefects(db: Database): Promise<OpenDefect[]> {
  return db
    .select({
      id: defect.id,
      machineId: defect.machineId,
      title: defect.title,
      priority: defect.priority,
      suitableForHelpers: defect.suitableForHelpers,
      openSince: defect.recordedAt,
    })
    .from(defect)
    .where(eq(defect.state, "open"))
    .orderBy(priorityRank, asc(defect.recordedAt), asc(defect.id));
}

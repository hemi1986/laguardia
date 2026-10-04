import { and, asc, eq } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import type { Defect } from "./defect";
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

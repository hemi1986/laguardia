import { machineLabels } from "@/modules/collection";
import { openDefects, type Priority } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { elapsedHours } from "@/platform/time";

/** What the open defects list is narrowed to (ST-021) – all optional, they combine. */
export type OpenDefectsFilter = {
  museumNumber?: string;
  priority?: Priority;
  suitableForHelpers?: boolean;
};

/** One entry of the open defects list as the page shows it (RM-OpenDefects, ST-021). */
export type OpenDefectsItem = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  title: string;
  priority: Priority;
  suitableForHelpers: boolean;
  openSince: Date;
  openHours: number;
};

export type OpenDefectsData = { entries: OpenDefectsItem[] };

/**
 * The open defects list's data: Repair's open defects with Collection's museum numbers and titles – the page composes
 * the modules' public queries (ST-009). How long a defect has been open is computed when the page loads.
 */
export async function loadOpenDefects(db: Database, clock: Clock, filter: OpenDefectsFilter): Promise<OpenDefectsData> {
  const defects = await openDefects(db, { suitableForHelpers: filter.suitableForHelpers });
  const machines = await machineLabels(
    db,
    defects.map((defect) => defect.machineId),
  );
  const now = clock.now();
  return {
    entries: defects.map((defect) => ({
      id: defect.id,
      museumNumber: machines.get(defect.machineId)?.museumNumber ?? "",
      machineModelTitle: machines.get(defect.machineId)?.machineModelTitle ?? "",
      title: defect.title,
      priority: defect.priority,
      suitableForHelpers: defect.suitableForHelpers,
      openSince: defect.openSince,
      openHours: elapsedHours(defect.openSince, now),
    })),
  };
}

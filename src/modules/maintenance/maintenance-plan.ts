import type { MachineCategory, Technology } from "@/modules/collection";
import type { CalendarDate } from "@/platform/time";

/**
 * A maintenance task of the maintenance plan (CONTEXT.md: Maintenance task; data model, ST-040): a recurring job with a
 * time-based interval in whole months, a short instruction, a *suitable for helpers* mark and optionally a restriction
 * to a machine category, or a machine category and a technology. Its start date counts as last done (HS-12).
 */
export type MaintenanceTask = {
  id: string;
  name: string;
  instruction: string;
  /** Whole months, positive. */
  intervalMonths: number;
  suitableForHelpers: boolean;
  /** No machine category: it applies to every machine. */
  machineCategory: MachineCategory | undefined;
  /** Only with a machine category it fits (AGG-MaintenancePlan invariant). */
  technology: Technology | undefined;
  startDate: CalendarDate;
  /** When it was removed (ST-041) – a removed maintenance task never becomes due again. */
  removedAt: Date | undefined;
};

/** AGG-MaintenancePlan – the single, museum-wide set of all maintenance tasks (CONTEXT.md: Maintenance plan). */
/** The ID of the one maintenance plan – created by the migration `drizzle/0019_maintenance_plan.sql`. */
export const MAINTENANCE_PLAN_ID = "7a1e0f40-0000-4000-8000-000000000040";

export type MaintenancePlan = {
  id: string;
  /** In the order they were added. */
  maintenanceTasks: MaintenanceTask[];
};

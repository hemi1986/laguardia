/** The outcomes of a maintenance record (CONTEXT.md: Maintenance record – Erledigt / Teilweise erledigt). */
export const maintenanceOutcomes = ["done", "partially-done"] as const;
export type MaintenanceOutcome = (typeof maintenanceOutcomes)[number];

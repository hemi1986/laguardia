import { eventCatalogue } from "@/platform/command";
import type { MaintenancePlanChanged } from "./change-maintenance-plan";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import type { MaintenanceRecorded } from "./record-maintenance";

/**
 * Maintenance's event catalogue (ST-079, architecture review 2026-10-17): per event its aggregate and what reaches the
 * journal. A maintenance task's name and instruction and a record's note are typed text and stay in the aggregates
 * (journal convention, 2026-09-27). A new Maintenance event is added here; its command passes `maintenanceEvents.journal`.
 */
export const maintenanceEvents = eventCatalogue({
  "EVT-MaintenancePlanChanged": {
    aggregate: "AGG-MaintenancePlan",
    project: (event: MaintenancePlanChanged) => ({
      aggregateId: MAINTENANCE_PLAN_ID,
      machineId: null,
      data: { maintenanceTaskId: event.maintenanceTaskId, change: event.change },
    }),
  },
  "EVT-MaintenanceRecorded": {
    aggregate: "AGG-MaintenanceRecord",
    project: (event: MaintenanceRecorded) => ({
      aggregateId: event.maintenanceRecordId,
      machineId: event.machineId,
      data: { maintenanceTaskId: event.maintenanceTaskId, outcome: event.outcome, date: event.date },
    }),
  },
});

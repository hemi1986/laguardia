import { bigserial, boolean, date, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { machineCategories, technologies } from "@/modules/collection";
import { maintenanceOutcomes } from "./maintenance-outcome";

/**
 * AGG-MaintenancePlan – the single, museum-wide maintenance plan (ST-040): one row, created by the migration, so every
 * change to the plan is a change of one aggregate at the version the technician saw (HS-16).
 */
export const maintenancePlan = pgTable("maintenance_plan", {
  id: uuid("id").primaryKey(),
  /** Optimistic version check (HS-16). */
  version: integer("version").notNull().default(0),
});

/**
 * The maintenance tasks of the plan (data model: Maintenance task entity, ST-040) – a list of entities that are changed
 * but never deleted: a removed maintenance task keeps `removed_at` (ST-041), and its maintenance records are kept.
 */
export const maintenanceTask = pgTable("maintenance_task", {
  /** The task's ID from the command's ID generator. */
  id: uuid("id").primaryKey(),
  /** The order the tasks were added in. */
  position: bigserial("position", { mode: "number" }).notNull(),
  maintenancePlanId: uuid("maintenance_plan_id")
    .notNull()
    .references(() => maintenancePlan.id),
  name: text("name").notNull(),
  instruction: text("instruction").notNull(),
  intervalMonths: integer("interval_months").notNull(),
  suitableForHelpers: boolean("suitable_for_helpers").notNull(),
  machineCategory: text("machine_category", { enum: machineCategories }),
  technology: text("technology", { enum: technologies }),
  /** A Berlin calendar date – it counts as last done (HS-12). */
  startDate: date("start_date", { mode: "string" }).notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true }),
});

/**
 * AGG-MaintenanceRecord (ST-044) – append-only, one row per machine and maintenance task carried out; never updated or
 * removed. machine_id and recorded_by are IDs of other modules – their foreign keys are added in the migration.
 */
export const maintenanceRecord = pgTable(
  "maintenance_record",
  {
    id: uuid("id").primaryKey(),
    machineId: uuid("machine_id").notNull(),
    maintenanceTaskId: uuid("maintenance_task_id")
      .notNull()
      .references(() => maintenanceTask.id),
    outcome: text("outcome", { enum: maintenanceOutcomes }).notNull(),
    /** The Berlin calendar day it was carried out – up to 7 days before it was recorded (D6). */
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"),
    recordedBy: uuid("recorded_by").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    /** The version check of every aggregate table – a maintenance record is never changed, so it stays 0. */
    version: integer("version").notNull().default(0),
  },
  (t) => [index("maintenance_record_task_machine_idx").on(t.maintenanceTaskId, t.machineId)],
);

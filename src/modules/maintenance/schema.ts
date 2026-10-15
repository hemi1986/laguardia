import { bigserial, boolean, date, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { machineCategories, technologies } from "@/modules/collection";

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

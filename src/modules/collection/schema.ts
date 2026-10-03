import { bigserial, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { machineCategories, technologies } from "./create-machine-model";
import { machineStatuses } from "./register-machine";

/** AGG-MachineModel – current state (docs/architecture/data-model.md). Files follow with ST-037. */
export const machineModel = pgTable("machine_model", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  manufacturer: text("manufacturer").notNull(),
  year: integer("year"),
  machineCategory: text("machine_category", { enum: machineCategories }).notNull(),
  technology: text("technology", { enum: technologies }),
  /** Optimistic version check (HS-16): corrections (ST-036) save at the version the technician saw. */
  version: integer("version").notNull().default(0),
});

/**
 * AGG-Machine – current state (ST-007). "… by" columns are TeamMemberIds; their foreign keys to team_member.id are
 * hand-written in the migration (a module's schema never imports another module's tables).
 */
export const machine = pgTable("machine", {
  id: uuid("id").primaryKey(),
  museumNumber: text("museum_number").notNull().unique(),
  machineModelId: uuid("machine_model_id")
    .notNull()
    .references(() => machineModel.id),
  serialNumber: text("serial_number"),
  location: text("location").notNull(),
  machineStatus: text("machine_status", { enum: machineStatuses }).notNull(),
  registeredAt: timestamp("registered_at", { withTimezone: true }).notNull(),
  retirementReason: text("retirement_reason"),
  retiredBy: uuid("retired_by"),
  retiredAt: timestamp("retired_at", { withTimezone: true }),
  /** Optimistic version check (HS-16). */
  version: integer("version").notNull().default(0),
});

/**
 * Every museum number ever given out – in use, of retired machines, and reserved after a correction (ST-035, D11).
 * The primary key guarantees uniqueness across all of them atomically (HS-17); a row is never deleted.
 */
export const museumNumber = pgTable("museum_number", {
  museumNumber: text("museum_number").primaryKey(),
  machineId: uuid("machine_id")
    .notNull()
    .references(() => machine.id),
});

/** The status history of a machine (data model: Status change entity); the first entry is the registration. */
export const machineStatusChange = pgTable(
  "machine_status_change",
  {
    /** The entry's ID from the command's ID generator – the history is saved insert-only by it (Q13, ST-012). */
    id: uuid("id").primaryKey(),
    /** The order the changes were stored in – changes of one command share their point in time (ST-007 review). */
    position: bigserial("position", { mode: "number" }).notNull(),
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machine.id),
    previousStatus: text("previous_status", { enum: machineStatuses }),
    newStatus: text("new_status", { enum: machineStatuses }).notNull(),
    reason: text("reason").notNull(),
    changedBy: uuid("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("machine_status_change_machine_idx").on(t.machineId)],
);

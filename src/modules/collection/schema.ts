import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { machineCategories, technologies } from "./create-machine-model";

/** AGG-MachineModel – current state (docs/architecture/data-model.md). Machines and files follow with ST-007/ST-037. */
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

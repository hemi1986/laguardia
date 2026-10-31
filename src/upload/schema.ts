import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Content a team member was allowed to upload from the browser that no file refers to yet (ST-085, ADR 0009). Recorded
 * when the server names the content; attaching it removes the record, and so does the cleanup of abandoned uploads
 * after the fixed age – a record is either attached or cleaned up, never both. Exactly one owner: a machine or a machine
 * model (check constraint and foreign keys in the migration – the upload module imports no module's tables).
 */
export const pendingUpload = pgTable(
  "pending_upload",
  {
    name: text("name").primaryKey(),
    machineId: uuid("machine_id"),
    machineModelId: uuid("machine_model_id"),
    issuedTo: uuid("issued_to").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    maximumSize: bigint("maximum_size", { mode: "number" }).notNull(),
    /** The exact size the browser declared – the upload address binds it (ST-099, ADR 0012). */
    declaredSize: bigint("declared_size", { mode: "number" }).notNull(),
  },
  (t) => [index("pending_upload_issued_at_idx").on(t.issuedAt)],
);

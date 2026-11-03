import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Content a team member was allowed to upload from the browser that no file refers to yet (ST-085, ADR 0009). Recorded
 * when the server names the content; attaching it removes the record, and so does the cleanup of abandoned uploads
 * after the fixed age – a record is either attached or cleaned up, never both. It belongs to the team member it was issued
 * to and to nobody else – no machine, no machine model (ADR 0018, which supersedes the owner of ADR 0009).
 */
export const pendingUpload = pgTable(
  "pending_upload",
  {
    name: text("name").primaryKey(),
    issuedTo: uuid("issued_to").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    maximumSize: bigint("maximum_size", { mode: "number" }).notNull(),
    /**
     * The exact size the browser declared – the upload address binds it, so the store holds nothing else (ST-099,
     * ADR 0012). A record only: attaching checks the stored size against `maximumSize`, as before.
     */
    declaredSize: bigint("declared_size", { mode: "number" }).notNull(),
  },
  (t) => [index("pending_upload_issued_at_idx").on(t.issuedAt)],
);

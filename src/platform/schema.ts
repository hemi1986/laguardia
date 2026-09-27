import { bigserial, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The append-only event journal (ADR 0002): every command appends its domain events in its own transaction.
 * It feeds dashboards, timelines and repair times; it is never replayed. Updates and deletes are refused by a trigger.
 */
export const eventJournal = pgTable(
  "event_journal",
  {
    position: bigserial("position", { mode: "number" }).primaryKey(),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    actorKind: text("actor_kind", { enum: ["team-member", "visitor", "system"] }).notNull(),
    actorTeamMemberId: text("actor_team_member_id"),
    actorRole: text("actor_role", { enum: ["helper", "technician"] }),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    machineId: text("machine_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    index("event_journal_aggregate_idx").on(t.aggregateId),
    index("event_journal_machine_idx").on(t.machineId),
    index("event_journal_occurred_at_idx").on(t.occurredAt),
  ],
);

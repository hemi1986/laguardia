import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** AGG-ProblemReport – current state (docs/architecture/data-model.md). Triage columns follow with ST-018 ff. */
export const problemReport = pgTable("problem_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  machineId: text("machine_id").notNull(),
  description: text("description").notNull(),
  reporterKind: text("reporter_kind", { enum: ["visitor", "team-member"] }).notNull(),
  reporterTeamMemberId: text("reporter_team_member_id"),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
});

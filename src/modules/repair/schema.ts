import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { triageOutcomes } from "./report-problem";

/** AGG-ProblemReport – current state (docs/architecture/data-model.md). Its triage: outcome, by whom, when (ST-017). */
export const problemReport = pgTable("problem_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** MachineId (ST-007); foreign key to machine.id is added in the migration (ADR 0002: modules share IDs, not tables). */
  machineId: uuid("machine_id").notNull(),
  description: text("description").notNull(),
  reporterKind: text("reporter_kind", { enum: ["visitor", "team-member"] }).notNull(),
  /** TeamMemberId (UUID from Better Auth); foreign key to team_member.id is added in the migration (ADR 0002: modules share IDs, not tables). */
  reporterTeamMemberId: uuid("reporter_team_member_id"),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
  /**
   * The Triage value object – all three set together, or none (untriaged). Added in ST-017 so "untriaged" means
   * something; the triage stories (ST-018 ff.) set them, and their defect, note or dismissal reason. triaged_by is a
   * TeamMemberId; its foreign key to team_member.id is added in the migration.
   */
  triageOutcome: text("triage_outcome", { enum: triageOutcomes }),
  triagedBy: uuid("triaged_by"),
  triagedAt: timestamp("triaged_at", { withTimezone: true }),
  /** Optimistic version check (HS-16): the problem report is the consistency boundary of triage. */
  version: integer("version").notNull().default(0),
});

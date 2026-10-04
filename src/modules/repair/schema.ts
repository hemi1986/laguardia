import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { defectStates, priorities } from "./defect";
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
  /** The stored photo's reference in the storage seam (ST-016) – optional; removed on spam dismissal (ST-020). */
  photo: text("photo"),
  /**
   * The Triage value object – all three set together, or none (untriaged). Added in ST-017 so "untriaged" means
   * something; the triage stories (ST-018 ff.) set them, and their defect, note or dismissal reason. triaged_by is a
   * TeamMemberId; its foreign key to team_member.id is added in the migration.
   */
  triageOutcome: text("triage_outcome", { enum: triageOutcomes }),
  triagedBy: uuid("triaged_by"),
  triagedAt: timestamp("triaged_at", { withTimezone: true }),
  /** The defect for the outcomes *defect recorded* and *linked* (ST-018, ST-022) – set exactly then (CHECK). */
  triageDefectId: uuid("triage_defect_id"),
  /** Optimistic version check (HS-16): the problem report is the consistency boundary of triage. */
  version: integer("version").notNull().default(0),
});

/**
 * AGG-Defect – current state (docs/architecture/data-model.md, ST-018). Created only through triage of a problem
 * report (HS-16). machine_id and recorded_by are IDs of other modules – their foreign keys are added in the migration.
 * Claims, holds, work log entries and resolutions follow with their stories.
 */
export const defect = pgTable("defect", {
  id: uuid("id").primaryKey(),
  machineId: uuid("machine_id").notNull(),
  problemReportId: uuid("problem_report_id")
    .notNull()
    .references(() => problemReport.id),
  title: text("title").notNull(),
  priority: text("priority", { enum: priorities }).notNull(),
  suitableForHelpers: boolean("suitable_for_helpers").notNull(),
  recordedBy: uuid("recorded_by").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  state: text("state", { enum: defectStates }).notNull(),
  /** Optimistic version check (HS-16). */
  version: integer("version").notNull().default(0),
});

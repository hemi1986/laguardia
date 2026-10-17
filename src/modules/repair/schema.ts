import { bigserial, boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { defectStates, holdReasons, priorities } from "./defect";
import { dismissalReasons, triageOutcomes } from "./report-problem";

/** AGG-ProblemReport – current state (docs/architecture/data-model.md). Its triage: outcome, by whom, when (ST-017). */
export const problemReport = pgTable("problem_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** MachineId (ST-007); foreign key to machine.id is added in the migration (ADR 0002: modules share IDs, not tables). */
  machineId: uuid("machine_id").notNull(),
  /** Required – except after a dismissal as spam, which removes it (ST-020, CHECK). */
  description: text("description"),
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
  /** The note for the outcome *resolved on the spot* (ST-019) – set exactly then (CHECK). */
  triageNote: text("triage_note"),
  /** The reason for the outcome *dismissed* (ST-020) – set exactly then (CHECK). */
  triageDismissalReason: text("triage_dismissal_reason", { enum: dismissalReasons }),
  /** The free text of the dismissal reason *other* (ST-020) – set exactly then (CHECK). */
  triageDismissalText: text("triage_dismissal_text"),
  /** Optimistic version check (HS-16): the problem report is the consistency boundary of triage. */
  version: integer("version").notNull().default(0),
});

/**
 * AGG-Defect – current state (docs/architecture/data-model.md, ST-018). Created only through triage of a problem
 * report (HS-16). machine_id and recorded_by are IDs of other modules – their foreign keys are added in the migration.
 * Holds follow with their story; its work log is `defectWorkLogEntry`, its resolutions are `defectResolution`.
 * The foreign key of problem_report_id is DEFERRABLE INITIALLY DEFERRED (hand-written, drizzle/0014, ST-023): a
 * technician's problem report and its defect refer to each other and are inserted together. Drizzle cannot express
 * that – a generated migration that touches this constraint must keep the deferral by hand.
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
  /**
   * The Claim value object (ST-025) – both set together, or none (unclaimed; CHECK in the migration). claimed_by is a
   * TeamMemberId; its foreign key to team_member.id is added in the migration.
   */
  claimedBy: uuid("claimed_by"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  /** The technician who assigned the claim (ST-026) – only with a claim, and none when the claimant claimed it themselves. */
  assignedBy: uuid("assigned_by"),
  /** The Hold value object (ST-029) – reason and since when together, or none (not on hold; CHECK in the migration). */
  holdReason: text("hold_reason", { enum: holdReasons }),
  /** Typed text – stays here, never in the journal (ST-003). */
  holdNote: text("hold_note"),
  heldAt: timestamp("held_at", { withTimezone: true }),
  /** Optimistic version check (HS-16). */
  version: integer("version").notNull().default(0),
});

/**
 * The resolutions of a defect (data model: Resolution entity, ST-028) – one per resolve, so closing notes survive a
 * reopening for the repair history. Rows are inserted only, never updated (Q13): a reopening gets rows of its own
 * (data model, ST-030). resolved_by is a TeamMemberId; its foreign key to team_member.id is added
 * in the migration.
 */
export const defectResolution = pgTable(
  "defect_resolution",
  {
    /** The entry's ID from the command's ID generator – the history is saved insert-only by it (Q13). */
    id: uuid("id").primaryKey(),
    /** The order the resolutions were stored in. */
    position: bigserial("position", { mode: "number" }).notNull(),
    defectId: uuid("defect_id")
      .notNull()
      .references(() => defect.id),
    closingNote: text("closing_note").notNull(),
    resolvedBy: uuid("resolved_by").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("defect_resolution_defect_idx").on(t.defectId)],
);

/**
 * The work log of a defect (data model: Work log entry entity, ST-024) – entries are only added, never changed or
 * removed. logged_by is a TeamMemberId; its foreign key to team_member.id is added in the migration. Photos follow with
 * ST-032.
 */
export const defectWorkLogEntry = pgTable(
  "defect_work_log_entry",
  {
    /** The entry's ID from the command's ID generator – the history is saved insert-only by it (Q13). */
    id: uuid("id").primaryKey(),
    /** The order the entries were stored in. */
    position: bigserial("position", { mode: "number" }).notNull(),
    defectId: uuid("defect_id")
      .notNull()
      .references(() => defect.id),
    whatWasDone: text("what_was_done").notNull(),
    partsUsed: text("parts_used"),
    loggedBy: uuid("logged_by").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("defect_work_log_entry_defect_idx").on(t.defectId)],
);

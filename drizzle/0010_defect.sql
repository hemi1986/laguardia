CREATE TABLE "defect" (
	"id" uuid PRIMARY KEY NOT NULL,
	"machine_id" uuid NOT NULL,
	"problem_report_id" uuid NOT NULL,
	"title" text NOT NULL,
	"priority" text NOT NULL,
	"suitable_for_helpers" boolean NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"state" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_report" ADD COLUMN "triage_defect_id" uuid;--> statement-breakpoint
ALTER TABLE "defect" ADD CONSTRAINT "defect_problem_report_id_problem_report_id_fk" FOREIGN KEY ("problem_report_id") REFERENCES "public"."problem_report"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- machine_id and recorded_by are IDs of other modules (ADR 0002: modules share IDs, not tables) – hand-written keys.
ALTER TABLE "defect" ADD CONSTRAINT "defect_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "defect" ADD CONSTRAINT "defect_recorded_by_fk" FOREIGN KEY ("recorded_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "defect" ADD CONSTRAINT "defect_priority" CHECK ("priority" IN ('high', 'normal', 'low'));--> statement-breakpoint
ALTER TABLE "defect" ADD CONSTRAINT "defect_state" CHECK ("state" IN ('open', 'resolved', 'closed-on-retirement'));--> statement-breakpoint
-- A problem report refers to a defect exactly for the outcomes "defect recorded" and "linked" (data model, ST-018).
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_defect" CHECK (("triage_defect_id" IS NOT NULL) = COALESCE("triage_outcome" IN ('defect-recorded', 'linked'), false));
--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_defect_id_fk" FOREIGN KEY ("triage_defect_id") REFERENCES "defect"("id") ON DELETE RESTRICT;

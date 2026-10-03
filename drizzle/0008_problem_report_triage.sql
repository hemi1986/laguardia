ALTER TABLE "problem_report" ADD COLUMN "triage_outcome" text;--> statement-breakpoint
ALTER TABLE "problem_report" ADD COLUMN "triaged_by" uuid;--> statement-breakpoint
ALTER TABLE "problem_report" ADD COLUMN "triaged_at" timestamp with time zone;--> statement-breakpoint
-- triaged_by is a TeamMemberId (ADR 0002: modules share IDs, not tables) – the foreign key is hand-written.
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triaged_by_fk" FOREIGN KEY ("triaged_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;

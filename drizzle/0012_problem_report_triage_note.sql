ALTER TABLE "problem_report" ADD COLUMN "triage_note" text;--> statement-breakpoint
-- ST-019: the note belongs to the outcome *resolved on the spot* – set exactly then (data model: Triage).
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_note" CHECK (("triage_note" IS NOT NULL) = COALESCE("triage_outcome" = 'resolved-on-the-spot', false));

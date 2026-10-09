ALTER TABLE "problem_report" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "problem_report" ADD COLUMN "triage_dismissal_reason" text;--> statement-breakpoint
ALTER TABLE "problem_report" ADD COLUMN "triage_dismissal_text" text;--> statement-breakpoint
-- ST-020: the reason belongs to the outcome *dismissed*, its free text to the reason *other* – set exactly then (data model: Triage).
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_dismissal_reason" CHECK (("triage_dismissal_reason" IS NOT NULL) = COALESCE("triage_outcome" = 'dismissed', false));--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_dismissal_reason_value" CHECK ("triage_dismissal_reason" IS NULL OR "triage_dismissal_reason" IN ('not-a-fault', 'spam', 'other', 'machine-retired'));--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_dismissal_text" CHECK (("triage_dismissal_text" IS NOT NULL) = COALESCE("triage_dismissal_reason" = 'other', false));--> statement-breakpoint
-- A problem report dismissed as spam has no description and no photo (AGG-ProblemReport invariant); every other one has a description.
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_spam_removed" CHECK (CASE WHEN COALESCE("triage_dismissal_reason" = 'spam', false) THEN "description" IS NULL AND "photo" IS NULL ELSE "description" IS NOT NULL END);

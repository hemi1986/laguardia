-- The Triage value object of a problem report is all three columns or none, with one of the known outcomes
-- (ST-017 review): a half-set triage would vanish from the triage list while the problem report still reads untriaged.
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_complete" CHECK (("triage_outcome" IS NULL) = ("triaged_by" IS NULL) AND ("triage_outcome" IS NULL) = ("triaged_at" IS NULL));--> statement-breakpoint
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_triage_outcome" CHECK ("triage_outcome" IS NULL OR "triage_outcome" IN ('defect-recorded', 'linked', 'resolved-on-the-spot', 'dismissed'));

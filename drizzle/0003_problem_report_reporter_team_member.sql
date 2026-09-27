-- ST-004: the reporting team member is a TeamMemberId – the UUID Better Auth assigns (ST-003 ID convention).
-- Spike rows (ST-001) were reported by visitors, so the column holds no values to convert.
ALTER TABLE "problem_report" ALTER COLUMN "reporter_team_member_id" SET DATA TYPE uuid USING "reporter_team_member_id"::uuid;--> statement-breakpoint
-- Hand-written: the Repair schema references the Team module's table by ID only (ADR 0002, lint rule), so the
-- foreign key lives in SQL, not in the Drizzle schema. RESTRICT: accounts are deactivated, never deleted (ST-005).
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_reporter_team_member_id_fk" FOREIGN KEY ("reporter_team_member_id") REFERENCES "team_member"("id") ON DELETE RESTRICT;

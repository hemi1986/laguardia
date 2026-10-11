-- ST-023: a technician's problem report is stored together with the defect recorded from it. The two rows refer to
-- each other (defect.problem_report_id, problem_report.triage_defect_id), so neither can be inserted first while both
-- foreign keys are checked per statement. The defect's reference is checked at the commit instead – it still holds for
-- every committed row.
ALTER TABLE "defect" ALTER CONSTRAINT "defect_problem_report_id_problem_report_id_fk" DEFERRABLE INITIALLY DEFERRED;

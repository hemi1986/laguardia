ALTER TABLE "defect" ADD COLUMN "assigned_by" uuid;--> statement-breakpoint
-- Assigned by belongs to the Claim value object: never without a claim (ST-026).
ALTER TABLE "defect" ADD CONSTRAINT "defect_claim_assigned_by" CHECK ("assigned_by" IS NULL OR "claimed_by" IS NOT NULL);--> statement-breakpoint
-- assigned_by is a TeamMemberId – another module's ID, so its foreign key is hand-written (ADR 0002).
ALTER TABLE "defect" ADD CONSTRAINT "defect_assigned_by_fk" FOREIGN KEY ("assigned_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;

ALTER TABLE "defect" ADD COLUMN "claimed_by" uuid;--> statement-breakpoint
ALTER TABLE "defect" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
-- The Claim value object: claimed by and claimed at together, or neither (ST-025).
ALTER TABLE "defect" ADD CONSTRAINT "defect_claim" CHECK (("claimed_by" IS NULL) = ("claimed_at" IS NULL));--> statement-breakpoint
-- claimed_by is a TeamMemberId – another module's ID, so its foreign key is hand-written (ADR 0002).
ALTER TABLE "defect" ADD CONSTRAINT "defect_claimed_by_fk" FOREIGN KEY ("claimed_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;

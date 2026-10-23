ALTER TABLE "defect" ADD COLUMN "closed_on_retirement_at" timestamp with time zone;--> statement-breakpoint
-- Closed on retirement at is set exactly for a defect closed on retirement (data model, ST-039).
ALTER TABLE "defect" ADD CONSTRAINT "defect_closed_on_retirement_at" CHECK (("state" = 'closed-on-retirement') = ("closed_on_retirement_at" IS NOT NULL));

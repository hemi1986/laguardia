ALTER TABLE "defect" ADD COLUMN "hold_reason" text;--> statement-breakpoint
ALTER TABLE "defect" ADD COLUMN "hold_note" text;--> statement-breakpoint
ALTER TABLE "defect" ADD COLUMN "held_at" timestamp with time zone;--> statement-breakpoint
-- The Hold value object: reason and since when together, or neither; a note only with a hold (ST-029).
ALTER TABLE "defect" ADD CONSTRAINT "defect_hold" CHECK (("hold_reason" IS NULL) = ("held_at" IS NULL) AND ("hold_note" IS NULL OR "hold_reason" IS NOT NULL));--> statement-breakpoint
-- Only an open defect can be on hold (AGG-Defect invariant).
ALTER TABLE "defect" ADD CONSTRAINT "defect_hold_only_open" CHECK ("hold_reason" IS NULL OR "state" = 'open');--> statement-breakpoint
-- The hold reasons of CONTEXT.md (On hold), like the other value lists of the defect.
ALTER TABLE "defect" ADD CONSTRAINT "defect_hold_reason_value" CHECK ("hold_reason" IS NULL OR "hold_reason" IN ('waiting-for-part', 'waiting-for-technician', 'other'));

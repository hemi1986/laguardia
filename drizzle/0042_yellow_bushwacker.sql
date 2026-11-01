-- What OpenRouter has charged for a held piece so far – a piece recorded broken off keeps it (user, 2026-11-01).
ALTER TABLE "ai_work_hold" ADD COLUMN "spent" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
-- A failed AI index entry keeps what its indexing cost before it failed (user, 2026-11-01, OPEN_QUESTIONS ST-109);
-- entries that failed before have none.
ALTER TABLE "ai_index_entry" DROP CONSTRAINT "ai_index_entry_state_shape";--> statement-breakpoint
ALTER TABLE "ai_index_entry" ADD CONSTRAINT "ai_index_entry_state_shape" CHECK (
  ("state" = 'failed' AND "failure_reason" IS NOT NULL AND "pages_indexed" IS NULL AND "images_indexed" IS NULL)
  OR ("state" = 'indexed' AND "failure_reason" IS NULL AND "pages_indexed" IS NOT NULL AND "images_indexed" IS NOT NULL AND "cost" IS NOT NULL)
);

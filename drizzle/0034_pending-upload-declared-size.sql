-- ST-099 (ADR 0012): content moves from Vercel Blob to S3 without migration – what pending uploads named is test data in
-- the old store and is discarded, so no pending upload needs a declared size made up for it.
DELETE FROM "pending_upload";--> statement-breakpoint
ALTER TABLE "pending_upload" ADD COLUMN "declared_size" bigint NOT NULL;

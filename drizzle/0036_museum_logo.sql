CREATE TABLE "museum_logo" (
	"id" uuid PRIMARY KEY NOT NULL,
	"content" text,
	"content_type" text,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Hand-written (ST-102): the logo – one part of the single museum settings – exists from the start, without a logo
-- (data model, *Museum settings*). Never created or removed by a command. Its ID is MUSEUM_LOGO_ID in the Collection
-- module.
INSERT INTO "museum_logo" ("id", "content", "content_type", "version")
VALUES ('7a1e0f40-0000-4000-8000-000000000102', NULL, NULL, 0);
--> statement-breakpoint
-- The invariant "at most one logo, a PNG, JPEG or WebP image" as the last guarantee: the content and its media type
-- come together, and only the three media types.
ALTER TABLE "museum_logo" ADD CONSTRAINT "museum_logo_content_with_type" CHECK (
  ("content" IS NULL AND "content_type" IS NULL)
  OR ("content" IS NOT NULL AND "content_type" IN ('image/png', 'image/jpeg', 'image/webp'))
);

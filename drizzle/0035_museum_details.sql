CREATE TABLE "museum_details" (
	"id" uuid PRIMARY KEY NOT NULL,
	"museum_name" text NOT NULL,
	"machines_listed" boolean NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Hand-written (ST-100): the museum details – one part of the single museum settings – exist from the start with their
-- defaults (data model, *Museum settings*): the name from docs/product/vision.md, the machines not listed. Never created
-- or removed by a command. Its ID is MUSEUM_DETAILS_ID in the Collection module.
INSERT INTO "museum_details" ("id", "museum_name", "machines_listed", "version")
VALUES ('7a1e0f40-0000-4000-8000-000000000100', 'Flipper- & Arcade Museum Eschbach', false, 0);
--> statement-breakpoint
-- The invariant "the museum name is never empty" as the last guarantee.
ALTER TABLE "museum_details" ADD CONSTRAINT "museum_details_name_not_empty" CHECK (btrim("museum_name") <> '');

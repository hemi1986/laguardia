CREATE TABLE "machine_model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"manufacturer" text NOT NULL,
	"year" integer,
	"machine_category" text NOT NULL,
	"technology" text,
	"version" integer DEFAULT 0 NOT NULL
);

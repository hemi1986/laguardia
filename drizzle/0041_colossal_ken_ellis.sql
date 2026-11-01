CREATE TABLE "ai_assessment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"defect_id" uuid NOT NULL,
	"note" text,
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"chat_model" text NOT NULL,
	"state" text NOT NULL,
	"summary" text,
	"probable_causes" text[],
	"what_to_check_first" text[],
	"references" jsonb,
	"files_searched" uuid[],
	"embedding_model" text,
	"cost" double precision,
	"changed_at" timestamp with time zone,
	"failure_reason" text,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_assessment_defect_idx" ON "ai_assessment" USING btree ("defect_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_assessment_being_written_idx" ON "ai_assessment" USING btree ("defect_id") WHERE "ai_assessment"."state" = 'requested';
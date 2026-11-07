CREATE TABLE "ai_model_proposal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"chat_model" text NOT NULL,
	"state" text NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_model_proposal_being_written_idx" ON "ai_model_proposal" USING btree ((true)) WHERE "ai_model_proposal"."state" = 'requested';
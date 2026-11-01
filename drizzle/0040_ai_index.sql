CREATE TABLE "ai_index_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"machine_id" uuid,
	"machine_model_id" uuid,
	"state" text NOT NULL,
	"embedding_model" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"failure_reason" text,
	"pages_indexed" integer,
	"images_indexed" integer,
	"cost" double precision,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_index_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"file_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"page" integer,
	"text" text,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_index_item" ADD CONSTRAINT "ai_index_item_file_id_ai_index_entry_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."ai_index_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_index_entry_embedding_model_idx" ON "ai_index_entry" USING btree ("embedding_model");--> statement-breakpoint
CREATE INDEX "ai_index_item_file_idx" ON "ai_index_item" USING btree ("file_id");
--> statement-breakpoint
-- Hand-written (ST-106): an entry belongs to exactly one machine or one machine model (copied from the file), and a
-- failed entry holds exactly one reason and no counts or cost – an indexed one counts and costs, and names no reason.
ALTER TABLE "ai_index_entry" ADD CONSTRAINT "ai_index_entry_one_owner" CHECK (("machine_id" IS NULL) <> ("machine_model_id" IS NULL));--> statement-breakpoint
ALTER TABLE "ai_index_entry" ADD CONSTRAINT "ai_index_entry_state_shape" CHECK (
  ("state" = 'failed' AND "failure_reason" IS NOT NULL AND "pages_indexed" IS NULL AND "images_indexed" IS NULL AND "cost" IS NULL)
  OR ("state" = 'indexed' AND "failure_reason" IS NULL AND "pages_indexed" IS NOT NULL AND "images_indexed" IS NOT NULL AND "cost" IS NOT NULL)
);--> statement-breakpoint
-- An item's shape by its kind: a passage has its text (a page's passage its page), a page image its page and no text,
-- an image file neither.
ALTER TABLE "ai_index_item" ADD CONSTRAINT "ai_index_item_kind_shape" CHECK (
  ("kind" = 'passage' AND "text" IS NOT NULL AND ("page" IS NULL OR "page" > 0))
  OR ("kind" = 'page-image' AND "page" IS NOT NULL AND "text" IS NULL)
  OR ("kind" = 'image' AND "page" IS NULL AND "text" IS NULL)
);

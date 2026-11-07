ALTER TABLE "ai_model_proposal" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "manufacturer" text;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "year" integer;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "machine_category" text;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "technology" text;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "sources" text[];--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "documents" jsonb;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "cost" double precision;--> statement-breakpoint
ALTER TABLE "ai_model_proposal" ADD COLUMN "changed_at" timestamp with time zone;
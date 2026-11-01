-- Hand-written (ST-112, ADR 0014): the AI index stores embeddings with pgvector – locally and in CI the image
-- pgvector/pgvector:pg17, on Neon the extension it offers. Enabled once, before any table uses the type.
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "ai_work_hold" (
	"kind" text NOT NULL,
	"piece_id" uuid NOT NULL,
	"held_by" uuid NOT NULL,
	"held_until" timestamp with time zone NOT NULL,
	CONSTRAINT "ai_work_hold_kind_piece_id_pk" PRIMARY KEY("kind","piece_id")
);

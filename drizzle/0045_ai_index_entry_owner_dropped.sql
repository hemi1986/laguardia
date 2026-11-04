-- Hand-written (ST-120, ADR 0018): an AI index entry names no machine and no machine model any more. The check that it
-- named exactly one of the two goes first. Nothing is indexed again and nothing else of an entry changes.
ALTER TABLE "ai_index_entry" DROP CONSTRAINT "ai_index_entry_one_owner";--> statement-breakpoint
ALTER TABLE "ai_index_entry" DROP COLUMN "machine_id";--> statement-breakpoint
ALTER TABLE "ai_index_entry" DROP COLUMN "machine_model_id";

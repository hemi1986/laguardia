-- Hand-edited (architecture review 2026-10-18): the column is added without a default first, so the entries written
-- before stay empty – with the default in ADD COLUMN, PostgreSQL would give every old entry the migration's
-- transaction and make them look like one command. Only new entries get the transaction that writes them.
ALTER TABLE "event_journal" ADD COLUMN "transaction_id" bigint;--> statement-breakpoint
ALTER TABLE "event_journal" ALTER COLUMN "transaction_id" SET DEFAULT (pg_current_xact_id()::text)::bigint;--> statement-breakpoint
CREATE INDEX "event_journal_transaction_idx" ON "event_journal" USING btree ("transaction_id");

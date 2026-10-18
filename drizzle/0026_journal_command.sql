ALTER TABLE "event_journal" ADD COLUMN "command_id" uuid;--> statement-breakpoint
CREATE INDEX "event_journal_command_idx" ON "event_journal" USING btree ("command_id");
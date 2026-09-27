CREATE TABLE "event_journal" (
	"position" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_kind" text NOT NULL,
	"actor_team_member_id" text,
	"actor_role" text,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"machine_id" text,
	"data" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problem_report" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "event_journal_aggregate_idx" ON "event_journal" USING btree ("aggregate_id");--> statement-breakpoint
CREATE INDEX "event_journal_machine_idx" ON "event_journal" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "event_journal_occurred_at_idx" ON "event_journal" USING btree ("occurred_at");--> statement-breakpoint
CREATE FUNCTION "event_journal_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'event_journal is append-only (ADR 0002)';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "event_journal_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON "event_journal"
  FOR EACH STATEMENT EXECUTE FUNCTION "event_journal_append_only"();

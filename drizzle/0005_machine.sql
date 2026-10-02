CREATE TABLE "machine" (
	"id" uuid PRIMARY KEY NOT NULL,
	"museum_number" text NOT NULL,
	"machine_model_id" uuid NOT NULL,
	"serial_number" text,
	"location" text NOT NULL,
	"machine_status" text NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"retirement_reason" text,
	"retired_by" uuid,
	"retired_at" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "machine_museum_number_unique" UNIQUE("museum_number")
);
--> statement-breakpoint
CREATE TABLE "machine_status_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"reason" text NOT NULL,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "museum_number" (
	"museum_number" text PRIMARY KEY NOT NULL,
	"machine_id" uuid NOT NULL
);
--> statement-breakpoint
-- ST-007 (story review 2026-09-27 decision 3, ST-001 code review #2; user 2026-10-01): before this migration no
-- machine can exist, so every problem report refers to a machine that is not registered – the ST-001 spike rows
-- ("test-machine") and other test data. They are deleted, so the machine reference can become a MachineId with a
-- foreign key. The event journal keeps its entries (append-only).
DELETE FROM "problem_report";--> statement-breakpoint
ALTER TABLE "problem_report" ALTER COLUMN "machine_id" SET DATA TYPE uuid USING "machine_id"::uuid;--> statement-breakpoint
ALTER TABLE "machine" ADD CONSTRAINT "machine_machine_model_id_machine_model_id_fk" FOREIGN KEY ("machine_model_id") REFERENCES "public"."machine_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_status_change" ADD CONSTRAINT "machine_status_change_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "museum_number" ADD CONSTRAINT "museum_number_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "machine_status_change_machine_idx" ON "machine_status_change" USING btree ("machine_id");--> statement-breakpoint
-- Hand-written: the Repair schema references the Collection module's table by ID only (ADR 0002, lint rule).
-- RESTRICT: machines are retired, never deleted (ST-039).
ALTER TABLE "problem_report" ADD CONSTRAINT "problem_report_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "machine"("id") ON DELETE RESTRICT;--> statement-breakpoint
-- Hand-written: "… by" are TeamMemberIds (data model); accounts are deactivated, never deleted (ST-005).
ALTER TABLE "machine_status_change" ADD CONSTRAINT "machine_status_change_changed_by_fk" FOREIGN KEY ("changed_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "machine" ADD CONSTRAINT "machine_retired_by_fk" FOREIGN KEY ("retired_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;

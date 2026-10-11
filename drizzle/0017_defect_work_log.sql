CREATE TABLE "defect_work_log_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"defect_id" uuid NOT NULL,
	"what_was_done" text NOT NULL,
	"parts_used" text,
	"logged_by" uuid NOT NULL,
	"logged_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "defect_work_log_entry" ADD CONSTRAINT "defect_work_log_entry_defect_id_defect_id_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defect"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "defect_work_log_entry_defect_idx" ON "defect_work_log_entry" USING btree ("defect_id");--> statement-breakpoint
-- logged_by is a TeamMemberId – another module's ID, so its foreign key is hand-written (ADR 0002).
ALTER TABLE "defect_work_log_entry" ADD CONSTRAINT "defect_work_log_entry_logged_by_fk" FOREIGN KEY ("logged_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;

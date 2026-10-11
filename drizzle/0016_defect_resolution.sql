CREATE TABLE "defect_resolution" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"defect_id" uuid NOT NULL,
	"closing_note" text NOT NULL,
	"resolved_by" uuid NOT NULL,
	"resolved_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "defect_resolution" ADD CONSTRAINT "defect_resolution_defect_id_defect_id_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defect"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "defect_resolution_defect_idx" ON "defect_resolution" USING btree ("defect_id");--> statement-breakpoint
-- resolved_by is a TeamMemberId – another module's ID, so its foreign key is hand-written (ADR 0002).
ALTER TABLE "defect_resolution" ADD CONSTRAINT "defect_resolution_resolved_by_fk" FOREIGN KEY ("resolved_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;

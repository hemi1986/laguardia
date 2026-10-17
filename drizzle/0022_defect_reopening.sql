CREATE TABLE "defect_reopening" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"defect_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reopened_by" uuid NOT NULL,
	"reopened_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "defect_reopening" ADD CONSTRAINT "defect_reopening_defect_id_defect_id_fk" FOREIGN KEY ("defect_id") REFERENCES "public"."defect"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "defect_reopening_defect_idx" ON "defect_reopening" USING btree ("defect_id");--> statement-breakpoint
-- reopened_by is a TeamMemberId – another module's ID, so its foreign key is hand-written (ADR 0002).
ALTER TABLE "defect_reopening" ADD CONSTRAINT "defect_reopening_reopened_by_fk" FOREIGN KEY ("reopened_by") REFERENCES "team_member"("id") ON DELETE RESTRICT;

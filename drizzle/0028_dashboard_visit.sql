CREATE TABLE "dashboard_visit" (
	"team_member_id" uuid PRIMARY KEY NOT NULL,
	"current_visit_started_at" timestamp with time zone NOT NULL,
	"last_visit" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboard_visit" ADD CONSTRAINT "dashboard_visit_team_member_id_team_member_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_member"("id") ON DELETE cascade ON UPDATE no action;
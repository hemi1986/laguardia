CREATE TABLE "problem_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" text NOT NULL,
	"description" text NOT NULL,
	"reporter_kind" text NOT NULL,
	"reporter_team_member_id" text,
	"reported_at" timestamp with time zone NOT NULL
);

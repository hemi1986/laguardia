CREATE TABLE "maintenance_plan" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenance_task" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"maintenance_plan_id" uuid NOT NULL,
	"name" text NOT NULL,
	"instruction" text NOT NULL,
	"interval_months" integer NOT NULL,
	"suitable_for_helpers" boolean NOT NULL,
	"machine_category" text,
	"technology" text,
	"start_date" date NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_maintenance_plan_id_maintenance_plan_id_fk" FOREIGN KEY ("maintenance_plan_id") REFERENCES "public"."maintenance_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-written (ST-040): the single, museum-wide maintenance plan exists from the start – every change is a change of
-- this one aggregate at the version the technician saw (HS-16). Its ID is MAINTENANCE_PLAN_ID in the Maintenance module.
INSERT INTO "maintenance_plan" ("id", "version") VALUES ('7a1e0f40-0000-4000-8000-000000000040', 0);
--> statement-breakpoint
-- The invariants of AGG-MaintenancePlan as the last guarantee: a positive interval, a technology only with a category.
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_interval_positive" CHECK ("interval_months" > 0);
--> statement-breakpoint
ALTER TABLE "maintenance_task" ADD CONSTRAINT "maintenance_task_technology_needs_category" CHECK ("technology" IS NULL OR "machine_category" IS NOT NULL);

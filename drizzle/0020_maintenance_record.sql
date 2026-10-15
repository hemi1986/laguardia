CREATE TABLE "maintenance_record" (
	"id" uuid PRIMARY KEY NOT NULL,
	"machine_id" uuid NOT NULL,
	"maintenance_task_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"date" date NOT NULL,
	"note" text,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_maintenance_task_id_maintenance_task_id_fk" FOREIGN KEY ("maintenance_task_id") REFERENCES "public"."maintenance_task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "maintenance_record_task_machine_idx" ON "maintenance_record" USING btree ("maintenance_task_id","machine_id");--> statement-breakpoint
-- Hand-written (ST-044): foreign keys to other modules' tables – a module's schema never imports them.
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "maintenance_record" ADD CONSTRAINT "maintenance_record_recorded_by_team_member_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."team_member"("id") ON DELETE no action ON UPDATE no action;

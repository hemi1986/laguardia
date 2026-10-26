CREATE TABLE "maintenance_task_machine" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"maintenance_plan_id" uuid NOT NULL,
	"maintenance_task_id" uuid NOT NULL,
	"machine_id" uuid NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "maintenance_task_machine_task_machine_unique" UNIQUE("maintenance_task_id","machine_id")
);
--> statement-breakpoint
ALTER TABLE "maintenance_task_machine" ADD CONSTRAINT "maintenance_task_machine_maintenance_plan_id_maintenance_plan_id_fk" FOREIGN KEY ("maintenance_plan_id") REFERENCES "public"."maintenance_plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_task_machine" ADD CONSTRAINT "maintenance_task_machine_maintenance_task_id_maintenance_task_id_fk" FOREIGN KEY ("maintenance_task_id") REFERENCES "public"."maintenance_task"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-written (ST-094): the foreign key to Collection's table – a module's schema never imports it.
ALTER TABLE "maintenance_task_machine" ADD CONSTRAINT "maintenance_task_machine_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Hand-written (ST-094, HS-23, HS-24): every maintenance task applies to the machines it applies to today under its
-- restriction (machines that are not retired whose machine model has its machine category and technology). For each,
-- "added" is the earlier of (a) the day it started counting under the old rule – the latest of the task's start date,
-- the machine's registration date and the day the task began to apply after a machine model correction – at midnight
-- in Europe/Berlin, and (b) when the earliest done maintenance record that counted under the old rule was recorded: a
-- done record that counted before still counts, so what is due stays due. A data change, not a step a technician took:
-- the event journal gets no entry.
DO $$
DECLARE
  v_task record;
  v_machine record;
  v_change record;
  v_index integer;
  v_run_index integer;
  v_run_start timestamptz;
  v_floor date;
  v_added timestamptz;
  v_first_recorded timestamptz;
BEGIN
  FOR v_task IN SELECT * FROM maintenance_task LOOP
    FOR v_machine IN
      SELECT ma.id, ma.registered_at, ma.machine_model_id
      FROM machine ma
      JOIN machine_model mm ON mm.id = ma.machine_model_id
      WHERE ma.retired_at IS NULL
        AND (v_task.machine_category IS NULL OR mm.machine_category = v_task.machine_category)
        AND (v_task.technology IS NULL OR mm.technology IS NOT DISTINCT FROM v_task.technology)
    LOOP
      -- Since when the task has applied without a break, if that began with a correction (not with the creation).
      v_index := 0;
      v_run_index := NULL;
      v_run_start := NULL;
      FOR v_change IN
        SELECT mmc.machine_category, mmc.technology, mmc.holds_from FROM machine_model_category_change mmc
        WHERE mmc.machine_model_id = v_machine.machine_model_id ORDER BY mmc.position, mmc.holds_from
      LOOP
        IF (v_task.machine_category IS NOT NULL AND v_change.machine_category <> v_task.machine_category)
           OR (v_task.technology IS NOT NULL AND v_change.technology IS DISTINCT FROM v_task.technology) THEN
          v_run_index := NULL;
          v_run_start := NULL;
        ELSIF v_run_index IS NULL THEN
          v_run_index := v_index;
          v_run_start := v_change.holds_from;
        END IF;
        v_index := v_index + 1;
      END LOOP;

      v_floor := GREATEST(
        v_task.start_date,
        (v_machine.registered_at AT TIME ZONE 'Europe/Berlin')::date,
        CASE WHEN v_run_index > 0 THEN (v_run_start AT TIME ZONE 'Europe/Berlin')::date END
      );
      v_added := v_floor::timestamp AT TIME ZONE 'Europe/Berlin';
      SELECT min(mr.recorded_at) INTO v_first_recorded FROM maintenance_record mr
        WHERE mr.maintenance_task_id = v_task.id AND mr.machine_id = v_machine.id AND mr.outcome = 'done' AND mr.date >= v_floor;
      IF v_first_recorded IS NOT NULL AND v_first_recorded < v_added THEN
        v_added := v_first_recorded;
      END IF;

      INSERT INTO maintenance_task_machine (id, maintenance_plan_id, maintenance_task_id, machine_id, added_at)
      VALUES (gen_random_uuid(), v_task.maintenance_plan_id, v_task.id, v_machine.id, v_added);
    END LOOP;
  END LOOP;
END $$;
--> statement-breakpoint
-- The restriction is gone, and with it the constraint that guarded it.
ALTER TABLE "maintenance_task" DROP CONSTRAINT "maintenance_task_technology_needs_category";--> statement-breakpoint
ALTER TABLE "maintenance_task" DROP COLUMN "machine_category";--> statement-breakpoint
ALTER TABLE "maintenance_task" DROP COLUMN "technology";--> statement-breakpoint
ALTER TABLE "maintenance_task" DROP COLUMN "start_date";
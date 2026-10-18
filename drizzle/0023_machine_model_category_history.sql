CREATE TABLE "machine_model_category_change" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"machine_model_id" uuid NOT NULL,
	"machine_category" text NOT NULL,
	"technology" text,
	"holds_from" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "machine_model_category_change" ADD CONSTRAINT "machine_model_category_change_machine_model_id_machine_model_id_fk" FOREIGN KEY ("machine_model_id") REFERENCES "public"."machine_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "machine_model_category_change_machine_model_idx" ON "machine_model_category_change" USING btree ("machine_model_id");--> statement-breakpoint
-- Every machine model existing before ST-036 gets its creation as the first entry of its category history: the values
-- it still has (nothing could change them before ST-036) from the time the journal recorded its creation. Without such
-- a journal entry it still gets one – Maintenance reads the first entry as the creation, whatever its time.
INSERT INTO "machine_model_category_change" ("id", "machine_model_id", "machine_category", "technology", "holds_from")
SELECT gen_random_uuid(), m."id", m."machine_category", m."technology", coalesce(j."occurred_at", '1970-01-01T00:00:00Z')
FROM "machine_model" m
LEFT JOIN "event_journal" j ON j."aggregate_id" = m."id"::text AND j."type" = 'EVT-MachineModelCreated'
ORDER BY j."occurred_at" NULLS FIRST;

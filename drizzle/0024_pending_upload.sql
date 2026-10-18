CREATE TABLE "pending_upload" (
	"name" text PRIMARY KEY NOT NULL,
	"machine_id" uuid,
	"machine_model_id" uuid,
	"issued_to" uuid NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"maximum_size" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pending_upload_issued_at_idx" ON "pending_upload" USING btree ("issued_at");--> statement-breakpoint
-- Hand-written (ST-085): the owners live in other modules' tables, which the upload module's schema does not import.
ALTER TABLE "pending_upload" ADD CONSTRAINT "pending_upload_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id");--> statement-breakpoint
ALTER TABLE "pending_upload" ADD CONSTRAINT "pending_upload_machine_model_id_machine_model_id_fk" FOREIGN KEY ("machine_model_id") REFERENCES "public"."machine_model"("id");--> statement-breakpoint
ALTER TABLE "pending_upload" ADD CONSTRAINT "pending_upload_issued_to_team_member_id_fk" FOREIGN KEY ("issued_to") REFERENCES "public"."team_member"("id");--> statement-breakpoint
ALTER TABLE "pending_upload" ADD CONSTRAINT "pending_upload_one_owner" CHECK (("machine_id" IS NULL) <> ("machine_model_id" IS NULL));

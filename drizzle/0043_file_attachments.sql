CREATE TABLE "file_attachment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"position" bigserial NOT NULL,
	"file_id" uuid NOT NULL,
	"machine_id" uuid,
	"machine_model_id" uuid
);
--> statement-breakpoint
DROP INDEX "file_machine_idx";--> statement-breakpoint
DROP INDEX "file_machine_model_idx";--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "original_file_name" text;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "added_by" uuid;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "added_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_file_id_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."file"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_machine_model_id_machine_model_id_fk" FOREIGN KEY ("machine_model_id") REFERENCES "public"."machine_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_attachment_file_idx" ON "file_attachment" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_attachment_machine_idx" ON "file_attachment" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "file_attachment_machine_model_idx" ON "file_attachment" USING btree ("machine_model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_attachment_file_machine_unique" ON "file_attachment" USING btree ("file_id","machine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_attachment_file_machine_model_unique" ON "file_attachment" USING btree ("file_id","machine_model_id");--> statement-breakpoint
-- Hand-written (ST-113, ADR 0018): a file has no owner any more; what it is attached to is its attachments.
-- Exactly one of machine and machine model per attachment, and "added by" refers to the Team module's table.
ALTER TABLE "file_attachment" ADD CONSTRAINT "file_attachment_one_target" CHECK (("machine_id" IS NULL) <> ("machine_model_id" IS NULL));--> statement-breakpoint
-- Existing files, removed ones included: the owner becomes the one attachment; "attached by" and "attached at" become
-- "added by" and "added at"; there is no original file name. Nothing is indexed again and no AI is called, and the
-- journal is not rewritten (it is a data change, not a step a person took).
UPDATE "file" SET "added_by" = "attached_by", "added_at" = "attached_at";--> statement-breakpoint
ALTER TABLE "file" ALTER COLUMN "added_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "file" ALTER COLUMN "added_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_added_by_team_member_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."team_member"("id");--> statement-breakpoint
INSERT INTO "file_attachment" ("id", "file_id", "machine_id", "machine_model_id")
SELECT gen_random_uuid(), "id", "machine_id", "machine_model_id" FROM "file" ORDER BY "attached_at", "id";

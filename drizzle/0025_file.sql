CREATE TABLE "file" (
	"id" uuid PRIMARY KEY NOT NULL,
	"machine_id" uuid,
	"machine_model_id" uuid,
	"title" text NOT NULL,
	"file_category" text NOT NULL,
	"content" text NOT NULL,
	"size" bigint NOT NULL,
	"content_type" text NOT NULL,
	"attached_by" uuid NOT NULL,
	"attached_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "file_content_unique" UNIQUE("content")
);
--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_machine_id_machine_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_machine_model_id_machine_model_id_fk" FOREIGN KEY ("machine_model_id") REFERENCES "public"."machine_model"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_machine_idx" ON "file" USING btree ("machine_id");--> statement-breakpoint
CREATE INDEX "file_machine_model_idx" ON "file" USING btree ("machine_model_id");--> statement-breakpoint
-- Hand-written (ST-037): exactly one owner, and "attached by" refers to the Team module's table.
ALTER TABLE "file" ADD CONSTRAINT "file_one_owner" CHECK (("machine_id" IS NULL) <> ("machine_model_id" IS NULL));--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_attached_by_team_member_id_fk" FOREIGN KEY ("attached_by") REFERENCES "public"."team_member"("id");

ALTER TABLE "file" ADD COLUMN "removed_by" uuid;--> statement-breakpoint
ALTER TABLE "file" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_removed_by_and_at" CHECK (("removed_by" IS NULL) = ("removed_at" IS NULL));--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_removed_by_team_member_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."team_member"("id");

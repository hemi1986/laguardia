ALTER TABLE "file" DROP CONSTRAINT "file_machine_id_machine_id_fk";
--> statement-breakpoint
ALTER TABLE "file" DROP CONSTRAINT "file_machine_model_id_machine_model_id_fk";
--> statement-breakpoint
ALTER TABLE "file" DROP COLUMN "machine_id";--> statement-breakpoint
ALTER TABLE "file" DROP COLUMN "machine_model_id";--> statement-breakpoint
ALTER TABLE "file" DROP COLUMN "attached_by";--> statement-breakpoint
ALTER TABLE "file" DROP COLUMN "attached_at";--> statement-breakpoint
ALTER TABLE "pending_upload" DROP COLUMN "machine_id";--> statement-breakpoint
ALTER TABLE "pending_upload" DROP COLUMN "machine_model_id";
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"encrypted_key" text,
	"key_last_four" text,
	"chat_model" text,
	"embedding_model" text,
	"version" integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
-- Hand-written (ST-104): the AI settings exist once from the start, without a key and without models – so AI is off
-- (data model, *AI settings*). Never created or removed by a command. Its ID is AI_SETTINGS_ID in AI assistance.
INSERT INTO "ai_settings" ("id", "version") VALUES ('7a1e0f40-0000-4000-8000-000000000104', 0);
--> statement-breakpoint
-- The key's last four characters come with the encrypted key, never without it.
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_key_with_last_four" CHECK (("encrypted_key" IS NULL) = ("key_last_four" IS NULL));

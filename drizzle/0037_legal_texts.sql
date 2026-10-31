CREATE TABLE "legal_texts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"privacy_notice_de" text DEFAULT '# Platzhalter

PLATZHALTER – Das Museum ersetzt diesen Entwurf vor dem Start durch seinen eigenen Datenschutzhinweis.

# Verantwortlich

Flipper- & Arcade Museum Eschbach. [PLATZHALTER: Anschrift und Kontakt des Museums]

# Meldungen

Auf diesen Seiten kannst du ein Problem an einem Gerät melden. Wir erheben keine Kontaktdaten: keinen Namen, keine E-Mail-Adresse, kein Konto.

Deine Meldung sehen nur die Teammitglieder des Museums.

# Fotos

Wenn du ein Foto zu deiner Meldung hinzufügst, entfernen wir die GPS-Daten aus dem Bild. Nur die Teammitglieder des Museums sehen das Foto.

Ein Foto wird so lange aufbewahrt wie seine Meldung.
' NOT NULL,
	"privacy_notice_en" text DEFAULT '# Placeholder

PLACEHOLDER – The museum replaces this draft with its own privacy notice before going live.

# Responsible

Flipper- & Arcade Museum Eschbach. [PLACEHOLDER: the museum''s address and contact]

# Problem reports

On these pages you can report a problem with a machine. We collect no contact data: no name, no e-mail address, no account.

Only the museum''s team members see your report.

# Photos

If you add a photo to your report, we remove the GPS data from the image. Only the museum''s team members see the photo.

A photo is kept as long as its report.
',
	"imprint_de" text,
	"imprint_en" text,
	"version" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
-- Hand-written (ST-103): the legal texts – one part of the single museum settings – exist from the start, with their
-- defaults: the placeholder privacy notice in German and English (the columns' defaults) and no imprint (data model,
-- *Museum settings*). Never created or removed by a command. Its ID is LEGAL_TEXTS_ID in the Collection module.
INSERT INTO "legal_texts" ("id") VALUES ('7a1e0f40-0000-4000-8000-000000000103');
--> statement-breakpoint
-- The invariants as the last guarantee: the German privacy notice is never empty, every other text is not provided
-- (null) or not empty, and an English imprint only together with a German one (HS-25).
ALTER TABLE "legal_texts" ADD CONSTRAINT "legal_texts_not_empty" CHECK (
  btrim("privacy_notice_de", E' \t\r\n') <> ''
  AND ("privacy_notice_en" IS NULL OR btrim("privacy_notice_en", E' \t\r\n') <> '')
  AND ("imprint_de" IS NULL OR btrim("imprint_de", E' \t\r\n') <> '')
  AND ("imprint_en" IS NULL OR btrim("imprint_en", E' \t\r\n') <> '')
);
--> statement-breakpoint
ALTER TABLE "legal_texts" ADD CONSTRAINT "legal_texts_english_imprint_with_german" CHECK (
  "imprint_en" IS NULL OR "imprint_de" IS NOT NULL
);

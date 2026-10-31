/**
 * The placeholder privacy notice ST-064 shipped, converted to Markdown (ST-103) – the default of the museum settings until
 * a technician changes the legal texts (data model, *Museum settings*). The visitor legal page's title is its main
 * heading, so these headings are its sections. Marked PLATZHALTER / PLACEHOLDER: the museum replaces it before going live.
 * These are the columns' defaults of `legal_texts` (`schema.ts`), so the migration and a reset use the same text.
 */
export const DEFAULT_PRIVACY_NOTICE_DE = `# Platzhalter

PLATZHALTER – Das Museum ersetzt diesen Entwurf vor dem Start durch seinen eigenen Datenschutzhinweis.

# Verantwortlich

Flipper- & Arcade Museum Eschbach. [PLATZHALTER: Anschrift und Kontakt des Museums]

# Meldungen

Auf diesen Seiten kannst du ein Problem an einem Gerät melden. Wir erheben keine Kontaktdaten: keinen Namen, keine E-Mail-Adresse, kein Konto.

Deine Meldung sehen nur die Teammitglieder des Museums.

# Fotos

Wenn du ein Foto zu deiner Meldung hinzufügst, entfernen wir die GPS-Daten aus dem Bild. Nur die Teammitglieder des Museums sehen das Foto.

Ein Foto wird so lange aufbewahrt wie seine Meldung.
`;

export const DEFAULT_PRIVACY_NOTICE_EN = `# Placeholder

PLACEHOLDER – The museum replaces this draft with its own privacy notice before going live.

# Responsible

Flipper- & Arcade Museum Eschbach. [PLACEHOLDER: the museum's address and contact]

# Problem reports

On these pages you can report a problem with a machine. We collect no contact data: no name, no e-mail address, no account.

Only the museum's team members see your report.

# Photos

If you add a photo to your report, we remove the GPS data from the image. Only the museum's team members see the photo.

A photo is kept as long as its report.
`;

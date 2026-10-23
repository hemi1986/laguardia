/**
 * The team UI's shared texts: the domain terms – keyed by the glossary term in the `_UI (de)_` wording of
 * CONTEXT.md (a test keeps both in sync; add a term when a page first needs it) – and what every form shares.
 */
export const sharedTexts = {
  terms: {
    "Team member": "Teammitglied",
    Helper: "Helfer:in",
    Technician: "Techniker:in",
    Visitor: "Besucher:in",
    Machine: "Gerät",
    "Machine model": "Modell",
    "Machine category": "Kategorie",
    Technology: "Technik",
    "Museum number": "Museumsnummer",
    "Serial number": "Seriennummer",
    "Status history": "Status-Historie",
    "Repair history": "Reparaturhistorie",
    "Maintenance plan": "Wartungsplan",
    Location: "Standort",
    File: "Datei",
    "Problem report": "Meldung",
    Triage: "Sichtung",
    Defect: "Defekt",
    "Suitable for helpers": "Für Helfer:innen geeignet",
    "Maintenance task": "Wartungsaufgabe",
    "Resolved on the spot": "Direkt behoben",
    "Closing note": "Abschlussnotiz",
    "Work log entry": "Arbeitsschritt",
  },
  /** Texts every form on the form runner shares (architecture review 2026-10-17). */
  forms: {
    /**
     * A change made meanwhile, on a form that keeps what was typed: its page shows the aggregate as it is now, so
     * sending again is all it takes (G8, G13) – reloading would throw the input away.
     */
    conflict: "Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.",
    /** After a rejection of a form that had a photo attached (G8a) – the browser cannot keep it. */
    photoAgain: "Das Foto muss erneut ausgewählt werden.",
  },
} as const;

/**
 * Texts of rejected commands whose codes several areas share (photo, upload, the command layer, a machine that is
 * unknown or retired), keyed by their kebab-case error code – an area's own codes are in its file.
 */
export const sharedErrors = {
  /** The photo errors (ST-016), defined once in the photo module. */
  "too-large": "Das Foto ist zu groß: höchstens 20 MB.",
  "not-an-image": "Das ist kein Foto. Bitte ein Foto wählen oder es weglassen.",
  "unsupported-format":
    "Dieses Bildformat wird nicht unterstützt. Bitte ein Foto (JPEG, PNG oder WebP) wählen oder es weglassen.",
  "not-stored": "Das Foto konnte nicht gesendet werden. Bitte noch einmal versuchen oder ohne Foto melden.",
  "title-required": "Bitte einen Titel angeben.",
  "file-required": "Bitte eine Datei auswählen.",
  "content-gone": "Die hochgeladene Datei ist nicht mehr da.",
  "unknown-machine": "Dieses Gerät gibt es nicht.",
  "technology-does-not-fit-machine-category": "Diese Technik passt nicht zu dieser Kategorie.",
  "machine-retired": "Dieses Gerät ist ausgemustert – daran lässt sich nichts mehr ändern oder melden.",
  "not-authorized": "Das dürfen nur Techniker:innen.",
  "not-found": "Das gibt es nicht mehr.",
  "version-conflict": "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
} as const;

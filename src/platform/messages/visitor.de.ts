/** A legal text of the visitor pages (ST-064), provided by the museum: a title and its sections. */
export type LegalText = {
  title: string;
  sections: readonly { heading: string; paragraphs: readonly string[] }[];
};

/** The privacy notice (ST-064). */
const privacyNotice: LegalText = {
  title: "Datenschutzhinweis",
  sections: [
    {
      heading: "Platzhalter",
      paragraphs: [
        "PLATZHALTER – Das Museum ersetzt diesen Entwurf vor dem Start durch seinen eigenen Datenschutzhinweis.",
      ],
    },
    {
      heading: "Verantwortlich",
      paragraphs: ["Flipper- & Arcade Museum Eschbach. [PLATZHALTER: Anschrift und Kontakt des Museums]"],
    },
    {
      heading: "Meldungen",
      paragraphs: [
        "Auf diesen Seiten kannst du ein Problem an einem Gerät melden. Wir erheben keine Kontaktdaten: keinen Namen, keine E-Mail-Adresse, kein Konto.",
        "Deine Meldung sehen nur die Teammitglieder des Museums.",
      ],
    },
    {
      heading: "Fotos",
      paragraphs: [
        "Wenn du ein Foto zu deiner Meldung hinzufügst, entfernen wir die GPS-Daten aus dem Bild. Nur die Teammitglieder des Museums sehen das Foto.",
        "Ein Foto wird so lange aufbewahrt wie seine Meldung.",
      ],
    },
  ],
};

/**
 * The legal pages (ST-064): the privacy notice at `/datenschutz` and the imprint at `/impressum`, linked from every
 * visitor page. The museum provides the texts; until it does, the privacy notice is a marked PLACEHOLDER (user,
 * 2026-10-04) – replacing it is part of the go-live (ST-042). No imprint (`null`) until the museum provides one: then
 * none is offered. German and English must agree on whether there is one (the same keys, `messages.test.ts`).
 */
const legal: {
  label: string;
  privacyNoticeLink: string;
  imprintLink: string;
  privacyNotice: LegalText;
  imprint: LegalText | null;
} = {
  label: "Rechtliches",
  privacyNoticeLink: "Datenschutz",
  imprintLink: "Impressum",
  privacyNotice,
  imprint: null,
};

/** German texts of the visitor pages; `visitor.en.ts` has the same keys. */
export const visitorDe = {
  /** The start page (ST-078). */
  home: {
    museum: "Flipper- & Arcade Museum Eschbach",
    teamLogin: "Anmeldung fürs Team",
  },
  /** The visitor machine page (ST-010) – what a visitor needs before reporting a problem, nothing more. */
  /** The language switch every visitor page shows (ST-010): it offers the other language, named in that language. */
  languageSwitch: "English",
  machinePage: {
    status: "Status",
    /** The machine statuses in the `_UI (de)_` wording of CONTEXT.md. */
    statuses: {
      playable: "Spielbereit",
      limited: "Eingeschränkt",
      "out-of-order": "Außer Betrieb",
      "not-on-display": "Nicht ausgestellt",
    },
    reportProblem: "Problem melden",
    /** The open defects' titles follow – untranslated, as the technician wrote them (ST-018). */
    knownDefects: "Bekannte Defekte",
    /**
     * The number of untriaged problem reports (HS-1) – all of them, so no "heute" (user, 2026-09-26); worded as what
     * waits for the team (user, 2026-10-03). What is known shows as the open defects' titles (ST-018).
     */
    alreadyReported: (count: number) =>
      count === 1
        ? "1 Meldung wartet noch auf die Sichtung durch das Team."
        : `${count} Meldungen warten noch auf die Sichtung durch das Team.`,
    notOnDisplay: "Dieses Gerät ist gerade nicht ausgestellt. Probleme kannst du nur für ausgestellte Geräte melden.",
    unknown: "Kein Gerät mit dieser Museumsnummer.",
    toStart: "Zur Startseite",
  },
  /** The report form page (ST-013) – nothing but the form; no name, no e-mail, no account. */
  reportForm: {
    title: "Problem melden",
    description: "Was ist das Problem?",
    descriptionHint: "Was passiert, wo am Gerät? Zum Beispiel: Kugel hängt hinter der linken Rampe.",
    send: "Meldung senden",
    back: "Zurück zum Gerät",
    /** Shown on the visitor machine page after a problem report (G3). */
    reported: "Danke! Deine Meldung ist beim Team angekommen.",
  },
  legal,
  /** Texts of rejected commands, keyed by their kebab-case error code (ST-073). */
  commandErrors: {
    "description-required": "Bitte beschreibe das Problem.",
    "description-too-long": "Bitte kürzer: höchstens 2000 Zeichen.",
    /** The photo errors (ST-016), defined once in the photo module – the original limit people know is 20 MB. */
    "too-large": "Das Foto ist zu groß: höchstens 20 MB.",
    "not-an-image": "Das ist kein Foto. Bitte wähle ein Foto aus oder lass es weg.",
    "unsupported-format": "Dieses Bildformat wird nicht unterstützt. Bitte wähle ein Foto (JPEG, PNG oder WebP) aus oder lass es weg.",
    "not-stored": "Das Foto konnte nicht gesendet werden. Versuche es noch einmal oder sende die Meldung ohne Foto.",
    "machine-not-on-display": "Dieses Gerät ist gerade nicht ausgestellt. Probleme kannst du nur für ausgestellte Geräte melden.",
    "machine-not-found": "Kein Gerät mit dieser Museumsnummer.",
    "machine-retired": "Dieses Gerät ist nicht mehr im Museum.",
    "not-authorized": "Das darfst du nicht.",
    "not-found": "Das gibt es nicht mehr.",
    "version-conflict": "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
  },
};

export type VisitorMessages = typeof visitorDe;

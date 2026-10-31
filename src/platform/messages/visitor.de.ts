/**
 * The legal pages (ST-064): the privacy notice at `/datenschutz` and the imprint at `/impressum`, linked from every
 * visitor page. Their texts are the museum's, written in the museum settings (ST-103) – only the frame's words are here.
 */
const legal = {
  label: "Rechtliches",
  privacyNoticeLink: "Datenschutz",
  imprintLink: "Impressum",
  /** The legal pages' titles – each page's main heading, above the museum's text. */
  privacyNoticeTitle: "Datenschutzhinweis",
  imprintTitle: "Impressum",
};

/** German texts of the visitor pages; `visitor.en.ts` has the same keys. */
export const visitorDe = {
  /** The welcome page (ST-078, ST-101). */
  welcomePage: {
    teamLogin: "Anmeldung fürs Team",
    /** Above the machines on display (ST-101) – only when they are listed and there is at least one. */
    machinesOnDisplay: "Etwas funktioniert nicht? Gerät antippen und Problem melden.",
    /** The machine categories heading the groups, in the `_UI (de)_` wording of CONTEXT.md (ST-101). */
    machineCategories: { pinball: "Flipper", arcade: "Arcade", other: "Sonstiges" },
    /** The logo above the museum name (ST-102), for screen readers. */
    logo: "Logo des Museums",

    /** An address that leads nowhere (ST-070: our own page, not Next.js' built-in one). */
    notFound: "Diese Seite gibt es nicht.",
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
    /** A retired machine's page says only this (ST-055). */
    noLongerInMuseum: "Dieses Gerät ist nicht mehr im Museum.",
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
    /**
     * The optional photo (ST-016). The notice states what La Guardia itself does with a photo; anything museum-specific
     * belongs in the privacy notice it links to (ST-103, user 2026-10-31).
     */
    photo: {
      label: "Foto (freiwillig)",
      take: "Foto aufnehmen",
      choose: "Foto auswählen",
      remove: "Foto entfernen",
      preparing: "Foto wird vorbereitet …",
      notice:
        "Das Foto sehen nur die Teammitglieder des Museums. Wir entfernen die GPS-Daten aus dem Bild und bewahren es so lange auf wie die Meldung.",
      noticeLink: "Datenschutzhinweis",
    },
    /** After a rejection of a form that had a photo attached (G8a, ST-084) – the browser cannot keep it. */
    photoAgain: "Das Foto muss erneut ausgewählt werden.",
  },
  legal,
  /** Texts of rejected commands, keyed by their kebab-case error code (ST-073). */
  commandErrors: {
    "description-required": "Bitte beschreibe das Problem.",
    "description-too-long": "Bitte kürzer: höchstens 2000 Zeichen.",
    /** The photo errors (ST-016), defined once in the photo module – the original limit people know is 20 MB. */
    "too-large": "Das Foto ist zu groß: höchstens 20 MB.",
    "not-an-image": "Das ist kein Foto. Bitte wähle ein Foto aus oder lass es weg.",
    "unsupported-format":
      "Dieses Bildformat wird nicht unterstützt. Bitte wähle ein Foto (JPEG, PNG oder WebP) aus oder lass es weg.",
    "not-stored": "Das Foto konnte nicht gesendet werden. Versuche es noch einmal oder sende die Meldung ohne Foto.",
    "machine-not-on-display":
      "Dieses Gerät ist gerade nicht ausgestellt. Probleme kannst du nur für ausgestellte Geräte melden.",
    "unknown-machine": "Kein Gerät mit dieser Museumsnummer.",
    "machine-retired": "Dieses Gerät ist nicht mehr im Museum.",
    /** Only for a logged-in technician who sends the visitors' form: their problem reports are triaged in the same step (ST-023). */
    "triage-required":
      "Als Techniker:in meldest du über die Geräteseite im Team-Bereich – dort wird die Meldung gleich gesichtet. Es wurde nichts gespeichert.",
    "not-authorized": "Das darfst du nicht.",
    "not-found": "Das gibt es nicht mehr.",
    "version-conflict": "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
  },
};

export type VisitorMessages = typeof visitorDe;

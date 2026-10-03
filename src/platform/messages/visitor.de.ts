/** German texts of the visitor pages; `visitor.en.ts` has the same keys. */
export const visitorDe = {
  /** The start page – a placeholder until the visitor machine page (ST-010) and the legal pages (ST-064), ST-078. */
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
    notOnDisplay: "Dieses Gerät ist gerade nicht ausgestellt. Probleme kannst du nur für ausgestellte Geräte melden.",
    unknown: "Kein Gerät mit dieser Museumsnummer.",
    toStart: "Zur Startseite",
  },
  /** Texts of rejected commands, keyed by their kebab-case error code (ST-073). */
  commandErrors: {
    "description-required": "Bitte beschreibe das Problem.",
    "machine-not-on-display": "Dieses Gerät ist gerade nicht ausgestellt. Probleme kannst du nur für ausgestellte Geräte melden.",
    "machine-not-found": "Kein Gerät mit dieser Museumsnummer.",
    "not-authorized": "Das darfst du nicht.",
    "not-found": "Das gibt es nicht mehr.",
    "version-conflict": "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
  },
};

export type VisitorMessages = typeof visitorDe;

/** German texts of the visitor pages; `visitor.en.ts` has the same keys. */
export const visitorDe = {
  problemReport: {
    label: "Problem melden",
    submit: "Melden",
  },
  /** Texts of rejected commands, keyed by their kebab-case error code (ST-073). */
  commandErrors: {
    "description-required": "Bitte beschreibe das Problem.",
    "not-authorized": "Das darfst du nicht.",
    "not-found": "Das gibt es nicht mehr.",
    "version-conflict": "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
  },
};

export type VisitorMessages = typeof visitorDe;

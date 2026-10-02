import type { VisitorMessages } from "./visitor.de";

/** English texts of the visitor pages – the same keys as `visitor.de.ts`. */
export const visitorEn: VisitorMessages = {
  home: {
    museum: "Flipper- & Arcade Museum Eschbach",
    teamLogin: "Team login",
  },
  machinePage: {
    status: "Status",
    /** The English names of the machine statuses in CONTEXT.md. */
    statuses: {
      playable: "Playable",
      limited: "Limited",
      "out-of-order": "Out of order",
      "not-on-display": "Not on display",
    },
    reportProblem: "Report a problem",
    notOnDisplay: "This machine is not on display at the moment. Problems can only be reported for machines on display.",
    unknown: (museumNumber: string) => `There is no machine with the museum number ${museumNumber}.`,
    switchLanguage: "Deutsch",
    language: "Language",
  },
  commandErrors: {
    "description-required": "Please describe the problem.",
    "not-authorized": "You are not allowed to do that.",
    "not-found": "This no longer exists.",
    "version-conflict": "Someone has changed this in the meantime. Please reload the page and try again.",
  },
};

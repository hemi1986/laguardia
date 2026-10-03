import type { VisitorMessages } from "./visitor.de";

/** English texts of the visitor pages – the same keys as `visitor.de.ts`. */
export const visitorEn: VisitorMessages = {
  home: {
    museum: "Flipper- & Arcade Museum Eschbach",
    teamLogin: "Team login",
  },
  /** The language switch every visitor page shows (ST-010): it offers the other language, named in that language. */
  languageSwitch: "Deutsch",
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
    alreadyReported: (count: number) =>
      `Already reported ${count === 1 ? "once" : `${count} times`} – not yet checked by the team.`,
    notOnDisplay: "This machine is not on display at the moment. Problems can only be reported for machines on display.",
    unknown: "There is no machine with this museum number.",
    toStart: "To the start page",
  },
  commandErrors: {
    "description-required": "Please describe the problem.",
    "description-too-long": "Please keep it shorter: at most 2000 characters.",
    "machine-not-on-display":
      "This machine is not on display at the moment. Problems can only be reported for machines on display.",
    "machine-not-found": "There is no machine with this museum number.",
    "not-authorized": "You are not allowed to do that.",
    "not-found": "This no longer exists.",
    "version-conflict": "Someone has changed this in the meantime. Please reload the page and try again.",
  },
};

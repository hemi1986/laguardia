import type { VisitorMessages } from "./visitor.de";

/** English texts of the visitor pages – the same keys as `visitor.de.ts`. */
export const visitorEn: VisitorMessages = {
  problemReport: {
    label: "Report a problem",
    submit: "Report",
  },
  commandErrors: {
    "description-required": "Please describe the problem.",
    "machine-required": "Please choose a machine.",
    "not-authorized": "You are not allowed to do that.",
    "not-found": "This no longer exists.",
    "version-conflict": "Someone has changed this in the meantime. Please reload the page and try again.",
  },
};

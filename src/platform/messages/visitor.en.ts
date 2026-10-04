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
    knownDefects: "Known defects",
    alreadyReported: (count: number) =>
      count === 1
        ? "1 report is waiting to be checked by the team."
        : `${count} reports are waiting to be checked by the team.`,
    notOnDisplay: "This machine is not on display at the moment. Problems can only be reported for machines on display.",
    unknown: "There is no machine with this museum number.",
    toStart: "To the start page",
  },
  reportForm: {
    title: "Report a problem",
    description: "What is the problem?",
    descriptionHint: "What happens, and where on the machine? For example: ball stuck behind the left ramp.",
    send: "Send report",
    back: "Back to the machine",
    reported: "Thank you! Your report has reached the team.",
  },
  legal: {
    label: "Legal",
    privacyNoticeLink: "Privacy",
    imprintLink: "Imprint",
    privacyNotice: {
      title: "Privacy notice",
      sections: [
        {
          heading: "Placeholder",
          paragraphs: ["PLACEHOLDER – The museum replaces this draft with its own privacy notice before going live."],
        },
        {
          heading: "Responsible",
          paragraphs: ["Flipper- & Arcade Museum Eschbach. [PLACEHOLDER: the museum's address and contact]"],
        },
        {
          heading: "Problem reports",
          paragraphs: [
            "On these pages you can report a problem with a machine. We collect no contact data: no name, no e-mail address, no account.",
            "Only the museum's team members see your report.",
          ],
        },
        {
          heading: "Photos",
          paragraphs: [
            "If you add a photo to your report, we remove the location data from the image. Only the museum's team members see the photo.",
            "A photo is kept as long as its report.",
          ],
        },
      ],
    },
    imprint: null,
  },
  commandErrors: {
    "description-required": "Please describe the problem.",
    "description-too-long": "Please keep it shorter: at most 2000 characters.",
    "machine-not-on-display":
      "This machine is not on display at the moment. Problems can only be reported for machines on display.",
    "machine-not-found": "There is no machine with this museum number.",
    "machine-retired": "This machine is no longer in the museum.",
    "not-authorized": "You are not allowed to do that.",
    "not-found": "This no longer exists.",
    "version-conflict": "Someone has changed this in the meantime. Please reload the page and try again.",
  },
};

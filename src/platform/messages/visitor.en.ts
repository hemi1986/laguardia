import type { VisitorMessages } from "./visitor.de";

/** English texts of the visitor pages – the same keys as `visitor.de.ts`. */
export const visitorEn: VisitorMessages = {
  welcomePage: {
    teamLogin: "Team login",
    /** Above the machines on display (ST-101, user 2026-10-31). */
    machinesOnDisplay: "Something not working? Tap a machine and report the problem.",
    /** The English names of the machine categories in CONTEXT.md (ST-101). */
    machineCategories: { pinball: "Pinball", arcade: "Arcade", other: "Other" },
    /** The logo above the museum name (ST-102), for screen readers. */
    logo: "The museum's logo",

    /** An address that leads nowhere (ST-070: our own page, not Next.js' built-in one). */
    notFound: "This page does not exist.",
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
    /** A retired machine's page says only this (ST-055). */
    noLongerInMuseum: "This machine is no longer in the museum.",
    notOnDisplay:
      "This machine is not on display at the moment. Problems can only be reported for machines on display.",
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
    photo: {
      label: "Photo (optional)",
      take: "Take a photo",
      choose: "Choose a photo",
      remove: "Remove photo",
      preparing: "Preparing the photo …",
      notice:
        "PLACEHOLDER – Only the museum's team members see the photo. We remove the GPS data from the image and keep it as long as the report.",
      noticeLink: "Privacy notice",
    },
    photoAgain: "Please choose the photo again.",
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
            "If you add a photo to your report, we remove the GPS data from the image. Only the museum's team members see the photo.",
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
    "too-large": "The photo is too large: at most 20 MB.",
    "not-an-image": "This is not a photo. Please choose a photo or leave it out.",
    "unsupported-format":
      "This image format is not supported. Please choose a photo (JPEG, PNG or WebP) or leave it out.",
    "not-stored": "The photo could not be sent. Please try again or send the report without a photo.",
    "machine-not-on-display":
      "This machine is not on display at the moment. Problems can only be reported for machines on display.",
    "unknown-machine": "There is no machine with this museum number.",
    "machine-retired": "This machine is no longer in the museum.",
    "triage-required":
      "As a technician, report from the machine record in the team area – the problem report is triaged right there. Nothing was saved.",
    "not-authorized": "You are not allowed to do that.",
    "not-found": "This no longer exists.",
    "version-conflict": "Someone has changed this in the meantime. Please reload the page and try again.",
  },
};

/**
 * The team UI's texts of the Repair context (BC-Repair): problem reports and their triage, defects, the repair
 * history.
 */
export const repairTexts = {
  /** The repair history's own page (ST-033): the years first, each with its number of entries (G4a). */
  repairHistory: {
    title: (museumNumber: string) => `Reparaturhistorie · ${museumNumber}`,
    year: (year: string, count: number) => `${year} · ${count === 1 ? "1 Eintrag" : `${count} Einträge`}`,
    chooseYear: "Welches Jahr?",
    defectOpen: "Offen",
    /** A defect its machine's retirement closed (ST-039) – not resolved, so no closing note. */
    closedOnRetirement: (at: string) => `Geschlossen (ausgemustert) am ${at}`,
    allYears: "Alle Jahre",
    backToMachine: "Zurück zum Gerät",
  },
  /** The photo of a problem report (ST-016) – shown to team members only (HS-1). */
  problemReportPhoto: {
    alt: "Foto zur Meldung",
  },
  /** The triage list and a problem report's own page (ST-017). */
  triage: {
    title: "Sichtung",
    waiting: (count: number) =>
      count === 1 ? "1 Meldung wartet auf die Sichtung." : `${count} Meldungen warten auf die Sichtung.`,
    nothing: "Nichts wartet auf die Sichtung – alle Meldungen sind gesichtet.",
    /** How long a problem report has been waiting, in words (G6). */
    waitingFor: (hours: number) =>
      hours < 1
        ? "wartet seit weniger als 1 Stunde"
        : hours < 24
          ? `wartet seit ${hours} ${hours === 1 ? "Stunde" : "Stunden"}`
          : `wartet seit ${Math.floor(hours / 24)} ${Math.floor(hours / 24) === 1 ? "Tag" : "Tagen"}`,
    /** Waiting longer than 3 days (HS-2) – said in words, not only by a colour (G6a). */
    longWait: "Wartet länger als 3 Tage",
    reportedBy: "Gemeldet von",
    reportedAt: "Gemeldet am",
    unknown: "Diese Meldung gibt es nicht.",
    alreadyTriaged: "Diese Meldung ist schon gesichtet.",
    /** A triage form rejected because someone triaged first – naming who (story review 2026-10-03). */
    alreadyTriagedBy: (name: string) => `${name} hat diese Meldung schon gesichtet.`,
    /** The section with the triage outcomes on a problem report's page (G21). */
    outcomes: "Sichten",
    recordDefect: "Defekt erfassen",
    back: "Zurück zur Sichtung",
  },
  /** The form „Mit Defekt verknüpfen“ (ST-022, story review 2026-10-03) and its confirmation on the triage list. */
  link: {
    title: (museumNumber: string) => `Mit Defekt verknüpfen · ${museumNumber}`,
    outcome: "Mit Defekt verknüpfen",
    /** A problem report's own page when its machine has nothing to link to (G7). */
    noOpenDefects: (museumNumber: string) => `${museumNumber} hat keine offenen Defekte.`,
    defect: "Offener Defekt",
    openSince: (when: string) => `offen seit ${when}`,
    submit: "Mit Defekt verknüpfen",
    back: "Zurück zur Meldung",
    linked: (museumNumber: string, title: string) => `Meldung zu ${museumNumber} mit Defekt „${title}“ verknüpft.`,
  },
  /** The form „Direkt behoben“ (ST-019, story review 2026-10-03) and its confirmation on the triage list. */
  resolveOnTheSpot: {
    title: (museumNumber: string) => `Direkt behoben · ${museumNumber}`,
    /** The field of the note (events.yaml) – UI wording only. */
    note: "Was wurde gemacht?",
    submit: "Als direkt behoben eintragen",
    back: "Zurück zur Meldung",
    resolved: (museumNumber: string) => `Meldung zu ${museumNumber} als direkt behoben eingetragen.`,
  },
  /**
   * The form „Meldung verwerfen“ (ST-020, story review 2026-10-03), its spam question (G10) and its confirmation on the
   * triage list. The reasons are the glossary's wording of *Dismissed*; „Gerät ausgemustert“ is never offered by hand.
   */
  dismiss: {
    title: (museumNumber: string) => `Meldung verwerfen · ${museumNumber}`,
    outcome: "Meldung verwerfen",
    reason: "Grund",
    reasons: { "not-a-fault": "Kein Defekt", spam: "Spam", other: "Anderer Grund" },
    reasonText: "Begründung (nur bei „Anderer Grund“)",
    submit: "Meldung verwerfen",
    spamQuestion: (museumNumber: string) =>
      `Meldung zu ${museumNumber} als Spam verwerfen? Beschreibung und Foto werden endgültig gelöscht.`,
    confirmSpam: "Endgültig verwerfen",
    /** Going back from the spam question to the form, spam still chosen. */
    questionBack: "Zurück",
    back: "Zurück zur Meldung",
    dismissed: (museumNumber: string) => `Meldung zu ${museumNumber} verworfen.`,
    /** A problem report's own page after a spam dismissal – the only place it is still shown (ST-020). */
    dismissedAsSpam: "Als Spam verworfen – Beschreibung und Foto sind gelöscht.",
  },
  /** The form „Defekt erfassen“ (ST-018, story review 2026-10-03) and its confirmation on the triage list. */
  recordDefect: {
    title: (museumNumber: string) => `Defekt erfassen · ${museumNumber}`,
    defectTitle: "Titel",
    titleHint: "Wird Besucher:innen am Gerät angezeigt – kurz und verständlich.",
    priority: "Priorität",
    /** The priorities (CONTEXT.md _UI (de)_), in the order the choice offers them; normal is preselected. */
    priorities: { high: "hoch", normal: "normal", low: "niedrig" },
    suitableForHelpers: "Für Helfer:innen geeignet",
    status: "Status",
    keepStatus: "Status nicht ändern",
    currentStatus: (museumNumber: string, status: string) => `${museumNumber} ist zurzeit ${status}.`,
    statusStays: (museumNumber: string, status: string) => `${museumNumber} ist schon ${status} – der Status bleibt.`,
    submit: "Defekt erfassen",
    back: "Zurück zur Meldung",
    recorded: (title: string, museumNumber: string) => `Defekt „${title}“ an ${museumNumber} erfasst.`,
    statusNow: (museumNumber: string, status: string) => ` ${museumNumber} ist jetzt ${status}.`,
    retiredMeanwhile: (museumNumber: string) =>
      `${museumNumber} ist inzwischen ausgemustert. Es wurde nichts gespeichert.`,
  },
  /** Reporting a problem and triaging it in the same step (ST-023, ST-052) – what its pages share. */
  reportAndTriage: {
    /** The choice page a technician sees instead of the plain report form (G21a). */
    triage: "Sichten",
    triagedWhenReporting: "Meldungen von Techniker:innen werden gleich beim Melden gesichtet.",
    /** Above the description of the helpers' plain report form (H2): the way to resolving on the spot in the same step. */
    alreadyResolved: "Schon selbst behoben?",
    /** The first section of every such form: the problem report. */
    report: "Meldung",
    /** As on the team's report form, without its sentence about triage – this problem report is triaged right here. */
    descriptionHint: "Was ist kaputt, wo am Gerät?",
  },
  /** … with the outcome *defect recorded* (ST-023) – technicians only. */
  reportAndRecordDefect: {
    title: (museumNumber: string) => `Problem melden und Defekt erfassen · ${museumNumber}`,
    submit: "Melden und Defekt erfassen",
  },
  /** … with the outcome *linked* (ST-052) – technicians only; the choice and the confirmation are ST-022's. */
  reportAndLink: {
    title: (museumNumber: string) => `Problem melden und mit Defekt verknüpfen · ${museumNumber}`,
    submit: "Melden und mit Defekt verknüpfen",
  },
  /** … with the outcome *resolved on the spot* (ST-052) – every team member; the field and the confirmation are ST-019's. */
  reportAndResolveOnTheSpot: {
    title: (museumNumber: string) => `Problem melden und als direkt behoben eintragen · ${museumNumber}`,
    submit: "Melden und als direkt behoben eintragen",
  },
  /** The open defects list and a defect's own page (ST-021). */
  defects: {
    title: "Defekte",
    /** All open defects, whatever the filter (G6). */
    open: (count: number) => (count === 1 ? "1 Defekt ist offen." : `${count} Defekte sind offen.`),
    /** No defect is open – and new ones come from triage (G7). */
    none: "Kein Defekt ist offen. Neue Defekte entstehen bei der Sichtung von Meldungen.",
    toTriage: "Zur Sichtung",
    priority: (priority: string) => `Priorität: ${priority}`,
    filter: "Defekte filtern",
    allMachines: "Alle Geräte",
    allPriorities: "Alle Prioritäten",
    onlySuitableForHelpers: "Nur für Helfer:innen geeignet",
    applyFilter: "Filtern",
    noneOfMachine: (museumNumber: string) => `${museumNumber} hat keine offenen Defekte.`,
    noneWithPriority: (priority: string) => `Kein offener Defekt hat die Priorität ${priority}.`,
    noneSuitableForHelpers: "Kein offener Defekt ist für Helfer:innen geeignet.",
    noneMatch: "Kein offener Defekt passt zu diesem Filter.",
    showAll: "Alle offenen Defekte anzeigen",
    /** How long a defect has been open, in words (G6) – the days are Berlin calendar days, counted by the page. */
    openFor: (days: number) => (days === 0 ? "offen seit heute" : `offen seit ${days} ${days === 1 ? "Tag" : "Tagen"}`),
    notSuitableForHelpers: "Nicht für Helfer:innen geeignet",
    recordedAt: (dateTime: string) => `Erfasst am ${dateTime}`,
    problemReports: "Meldungen",
    /** The problem report the defect was recorded from, and those linked to it later (ST-022). */
    originating: "Ursprüngliche Meldung",
    linked: "Verknüpfte Meldung",
    /** How many problem reports were linked to an open defect (ST-022) – shown in the list only when there are any. */
    linkedProblemReports: (count: number) => (count === 1 ? "1 verknüpfte Meldung" : `${count} verknüpfte Meldungen`),
    unknown: "Diesen Defekt gibt es nicht.",
    back: "Zurück zu den Defekten",
    /** Claiming a defect (ST-025; CONTEXT.md: Claim = „Übernehmen“) – the claimant in the list and on the defect's page. */
    claimedBy: (name: string) => `Übernommen von ${name}`,
    claimedByYou: "Von dir übernommen",
    /** The buttons on the defect's page (G14): claiming an unclaimed defect, or taking it over from its claimant. */
    claim: "Übernehmen",
    takeOverFrom: (name: string) => `Von ${name} übernehmen`,
    /** The confirmation (G3) – after taking it over followed by whom it was taken over from. */
    claimed: (title: string) => `Du hast „${title}“ übernommen.`,
    takenOverFrom: (name: string) => ` Vorher: ${name}.`,
    /** The filter "claimed by me" of the open defects list, and what it says when it matches nothing (G7). */
    onlyClaimedByMe: "Nur von mir übernommene",
    noneClaimedByYou: "Du hast keinen offenen Defekt übernommen.",
    /** A defect on hold (ST-029, CONTEXT.md: On hold): the reasons in glossary order, and how a defect says it waits. */
    holdReasons: {
      "waiting-for-part": "Wartet auf Ersatzteil",
      "waiting-for-technician": "Wartet auf Techniker:in",
      other: "Anderer Grund",
    },
    onHold: (reason: string) => `Pausiert – ${reason}`,
    /** The filter "on hold" of the open defects list, and what it says when it matches nothing (G7). */
    onlyOnHold: "Nur pausierte",
    noneOnHold: "Kein offener Defekt ist pausiert.",
    /**
     * Releasing a claim and assigning a defect (ST-026, G22; CONTEXT.md: Release = „Abgeben“ / „Übernahme aufheben“,
     * Assign = „Zuweisen“): „Abgeben“ stands where „Übernehmen“ stood; the rest is behind the fold „Verwalten“.
     */
    release: "Abgeben",
    releaseClaimOf: (name: string) => `Übernahme von ${name} aufheben`,
    released: (title: string) => `„${title}“ ist wieder frei.`,
    manage: "Verwalten",
    assign: "Zuweisen",
    assignTitle: (museumNumber: string) => `Defekt zuweisen · ${museumNumber}`,
    assignTo: "Zuweisen an",
    assignChoose: "Bitte wählen",
    assignee: (name: string, role: string) => `${name} (${role})`,
    assignToNobody: "Es gibt gerade niemanden, dem dieser Defekt zugewiesen werden kann.",
    assigned: (title: string, name: string) => `Du hast „${title}“ ${name} zugewiesen.`,
    assignedBy: (name: string) => `Zugewiesen von ${name}`,
    assignedByYou: "Von dir zugewiesen",
    /** Changing a defect's priority (ST-027, G22): behind „Verwalten“, with a form page of its own (G21). */
    prioritize: "Priorität ändern",
    prioritizeTitle: (museumNumber: string) => `Priorität ändern · ${museumNumber}`,
    prioritizeTo: "Neue Priorität",
    prioritizeChoose: "Bitte wählen",
    prioritized: (title: string, priority: string) => `„${title}“ hat jetzt die Priorität ${priority}.`,
    /**
     * Changing a defect's title or suitable-for-helpers mark (ST-031, G22): „Titel und Eignung ändern“ behind „Verwalten“
     * leads to its form page; the confirmation names each change and a claim it released.
     */
    changeDetails: "Titel und Eignung ändern",
    changeDetailsTitle: (museumNumber: string) => `Titel und Eignung ändern · ${museumNumber}`,
    changeDetailsSubmit: "Defekt ändern",
    removingMarkReleases: (name: string) => `Ohne diese Markierung wird die Übernahme von ${name} aufgehoben.`,
    titleChanged: (title: string) => `Der Titel ist jetzt „${title}“.`,
    nowSuitableForHelpers: (title: string) => `„${title}“ ist jetzt für Helfer:innen geeignet.`,
    noLongerSuitableForHelpers: (title: string) => `„${title}“ ist nicht mehr für Helfer:innen geeignet.`,
    claimOfReleased: (name: string) => `Die Übernahme von ${name} ist aufgehoben.`,
    /** Resolving a defect (ST-028): the button on its page (G14, G21), which leads to the form's own page. */
    resolve: "Beheben",
    resolveTitle: (museumNumber: string) => `Defekt beheben · ${museumNumber}`,
    resolveSubmit: "Als behoben eintragen",
    backToDefect: "Zurück zum Defekt",
    /**
     * Reopening a resolved defect (ST-030, G22): „Wieder öffnen“ under its closing note leads to its form page; the
     * page of a reopened defect says who reopened it, when and why, after the closing note it followed.
     */
    reopen: "Wieder öffnen",
    reopenTitle: (museumNumber: string) => `Defekt wieder öffnen · ${museumNumber}`,
    reopenReason: "Warum wieder öffnen?",
    reopened: (title: string) => `„${title}“ ist wieder offen.`,
    reopenedBy: (name: string, dateTime: string) => `Wieder geöffnet von ${name} am ${dateTime}`,
    /**
     * Putting a defect on hold (ST-029, G22): „Pausieren“ in the work group leads to its form page; the confirmation
     * names the reason. „Fortsetzen“ stands in its place while the defect is on hold – one tap.
     */
    putOnHold: "Pausieren",
    putOnHoldTitle: (museumNumber: string) => `Defekt pausieren · ${museumNumber}`,
    holdReason: "Grund",
    holdReasonChoose: "Bitte wählen",
    holdNote: "Notiz (optional)",
    putOnHoldDone: (title: string, reason: string) => `„${title}“ ist pausiert – ${reason}.`,
    resume: "Fortsetzen",
    resumed: (title: string) => `„${title}“ geht weiter.`,
    /** How a resolved defect ended, on its page – and the confirmation for who resolved it (G3). */
    resolvedBy: (name: string, dateTime: string) => `Behoben von ${name} am ${dateTime}`,
    resolved: (title: string) => `Du hast „${title}“ behoben.`,
    /** The work log (ST-024) on the defect's page, newest entry first, and its last entry in the open defects list. */
    workLog: "Arbeitsschritte",
    noWorkLogged: "Noch kein Arbeitsschritt eingetragen.",
    partsUsedLine: (partsUsed: string) => `Verwendete Teile: ${partsUsed}`,
    lastWorkLogEntry: (dateTime: string, name: string) => `Letzter Arbeitsschritt: ${dateTime} · ${name}`,
    /** Logging work: the button on the defect's page (G14, G21), the form's own page and the confirmation (G3). */
    logWork: "Arbeitsschritt eintragen",
    logWorkTitle: (museumNumber: string) => `Arbeitsschritt eintragen · ${museumNumber}`,
    whatWasDone: "Was wurde gemacht?",
    partsUsed: "Verwendete Teile (optional)",
    workLogged: (title: string) => `Arbeitsschritt zu „${title}“ eingetragen.`,
    /**
     * A change of the defect made meanwhile (a claim, another work log entry) – the expected rejection of this form.
     * The form already shows the defect as it is now and keeps the texts, so sending again is all it takes.
     */
    logWorkConflict:
      "Jemand hat den Defekt inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal eintragen.",
  },
  reportProblem: {
    title: (museumNumber: string) => `Problem melden · ${museumNumber}`,
    description: "Beschreibung",
    descriptionHint: "Was ist kaputt, wo am Gerät? Eine Techniker:in sichtet die Meldung.",
    submit: "Meldung erfassen",
    retired: "Dieses Gerät ist ausgemustert – dafür gibt es keine Meldungen mehr.",
    back: "Zurück zum Gerät",
    /** The optional photo (ST-016) – the browser's own rejections use the photo errors' texts below. */
    photo: {
      label: "Foto (freiwillig)",
      take: "Foto aufnehmen",
      choose: "Foto auswählen",
      remove: "Foto entfernen",
      preparing: "Foto wird vorbereitet …",
    },
  },
} as const;

/**
 * Texts of Repair's rejected commands, keyed by their kebab-case error code (shared codes: `shared.ts`).
 */
export const repairErrors = {
  "machine-not-on-display": "Dieses Gerät ist nicht ausgestellt.",
  "description-required": "Bitte das Problem beschreiben.", // G13: team instructions use the infinitive (ST-084)
  /** A technician's problem report needs its triage outcome in the same step (ST-023). */
  "triage-required": "Bitte wählen, wie die Meldung gesichtet wird. Es wurde nichts gespeichert.",
  "already-triaged": "Diese Meldung ist schon gesichtet.",
  "note-required": "Bitte kurz beschreiben, was gemacht wurde.",
  "dismissal-reason-required": "Bitte einen Grund auswählen.",
  "dismissal-reason-text-required": "Bitte den Grund beschreiben.",
  "defect-required": "Bitte einen Defekt auswählen.",
  "defect-of-another-machine": "Dieser Defekt gehört zu einem anderen Gerät.",
  "defect-not-open": "Dieser Defekt ist nicht mehr offen.",
  "not-suitable-for-helpers": "Dieser Defekt ist nicht für Helfer:innen geeignet.",
  "already-claimed-by-you": "Du hast diesen Defekt schon übernommen.",
  /** Assigning a defect (ST-026). */
  "team-member-required": "Bitte ein Teammitglied auswählen.",
  "team-member-not-active": "Dieses Teammitglied hat kein aktives Konto. Bitte jemand anderen auswählen.",
  "already-claimed-by-them": "Dieses Teammitglied hat den Defekt schon übernommen.",
  /** Changing a defect's priority (ST-027). */
  "priority-required": "Bitte eine Priorität auswählen.",
  "priority-unchanged": "Der Defekt hat diese Priorität schon. Bitte eine andere wählen.",
  /** Changing a defect's details (ST-031). */
  "details-unchanged": "Titel und Eignung sind unverändert. Bitte etwas ändern.",
  /** Releasing a claim (ST-026). */
  "not-claimed": "Diesen Defekt hat gerade niemand übernommen.",
  /** Reopening a defect (ST-030). */
  "defect-not-resolved": "Nur ein behobener Defekt kann wieder geöffnet werden.",
  "reopen-reason-required": "Bitte angeben, warum der Defekt wieder geöffnet wird.",
  /** Putting a defect on hold and resuming it (ST-029). */
  "defect-on-hold": "Dieser Defekt ist schon pausiert.",
  "defect-not-on-hold": "Dieser Defekt ist nicht pausiert.",
  "not-claimant": "Das dürfen nur Techniker:innen und wer den Defekt übernommen hat.",
  "hold-reason-required": "Bitte einen Grund wählen.",
  "not-your-claim": "Die Übernahme von jemand anderem können nur Techniker:innen aufheben.",
  "closing-note-required": "Bitte kurz beschreiben, wie der Defekt behoben wurde.",
  "what-was-done-required": "Bitte kurz beschreiben, was gemacht wurde.",
  "machine-status-not-stricter": "Diesen Status kann ein Defekt nicht setzen. Bitte die Seite neu laden.",
  "description-too-long": "Bitte kürzer: höchstens 2000 Zeichen.",
} as const;

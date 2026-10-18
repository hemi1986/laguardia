/**
 * German texts of the team UI. Domain terms use the `_UI (de)_` wording of CONTEXT.md, keyed by the glossary term
 * (a test keeps both in sync) – add a term here when a page first needs it.
 */
export const teamMessages = {
  terms: {
    "Team member": "Teammitglied",
    Helper: "Helfer:in",
    Technician: "Techniker:in",
    Visitor: "Besucher:in",
    Machine: "Gerät",
    "Machine model": "Modell",
    "Machine category": "Kategorie",
    Technology: "Technik",
    "Museum number": "Museumsnummer",
    "Serial number": "Seriennummer",
    "Status history": "Status-Historie",
    "Repair history": "Reparaturhistorie",
    "Maintenance plan": "Wartungsplan",
    Location: "Standort",
    File: "Datei",
    "Problem report": "Meldung",
    Triage: "Sichtung",
    Defect: "Defekt",
    "Suitable for helpers": "Für Helfer:innen geeignet",
    "Maintenance task": "Wartungsaufgabe",
    "Resolved on the spot": "Direkt behoben",
    "Closing note": "Abschlussnotiz",
    "Work log entry": "Arbeitsschritt",
  },
  login: {
    title: "Anmelden",
    username: "Benutzername",
    password: "Passwort",
    submit: "Anmelden",
    failed: "Anmeldung fehlgeschlagen. Bitte Benutzername und Passwort prüfen.",
    locked: "Zu viele fehlgeschlagene Versuche. Bitte in 15 Minuten erneut versuchen.",
  },
  team: {
    menu: "Navigation",
    dashboard: "Übersicht",
    more: "Mehr",
    start: "La Guardia – Team",
    loggedInAs: "Angemeldet als",
    logout: "Abmelden",
    accounts: "Teammitglieder",
    maintenance: "Wartung",
    maintenancePlan: "Wartungsplan",
    machineModels: "Modelle",
    machines: "Geräte",
    triage: "Sichtung",
    defects: "Defekte",
    ownPassword: "Passwort ändern",
  },
  machineModels: {
    title: "Modelle",
    newMachineModel: "Neues Modell",
    modelTitle: "Titel",
    manufacturer: "Hersteller",
    year: "Baujahr",
    choose: "Bitte wählen",
    noTechnology: "keine",
    create: "Modell anlegen",
    empty: "Noch keine Modelle angelegt.",
    /** The machine categories, in the German wording of their definition in CONTEXT.md. */
    categories: { pinball: "Flipper", arcade: "Arcade", other: "Sonstiges" },
    technologies: { em: "EM", "solid-state": "Solid-State", dmd: "DMD", lcd: "LCD", crt: "CRT" },
  },
  machines: {
    title: "Geräte",
    register: "Gerät erfassen",
    empty: "Noch kein Gerät erfasst.",
    registered: (museumNumber: string, machineModel: string) => `Gerät ${museumNumber} (${machineModel}) erfasst.`,
    status: "Status",
    /** The machine statuses (CONTEXT.md _UI (de)_), in the order the registration offers them (user, 2026-10-01). */
    statuses: {
      playable: "Spielbereit",
      limited: "Eingeschränkt",
      "out-of-order": "Außer Betrieb",
      "not-on-display": "Nicht ausgestellt",
    },
    choose: "Bitte wählen",
    museumNumberHint: "Leer lassen, dann vergibt La Guardia die nächste freie Nummer.",
    serialNumberHint: "Falls lesbar – sonst leer lassen.",
    noMachineModels: "Noch kein Modell angelegt. Ein Gerät braucht sein Modell – bitte zuerst eines anlegen.",
    toMachineModels: "Zu den Modellen",
    back: "Zurück zu den Geräten",
    search: "Suche",
    searchHint: "Museumsnummer oder Titel, z. B. 042 oder Medieval",
    searchSubmit: "Suchen",
    filter: "Nach Status filtern",
    all: "Alle",
    noMatch: (search: string) => `Kein Gerät passt zu „${search}“.`,
    clearSearch: "Suche zurücksetzen",
    noneWithStatus: (status: string) => `Kein Gerät ist ${status}.`,
    /** The open defects of a machine (ST-021) – never zero, a zero is not shown. */
    openDefects: (count: number) => (count === 1 ? "1 offener Defekt" : `${count} offene Defekte`),
  },
  stickers: {
    title: "QR-Sticker drucken",
    print: "QR-Sticker drucken",
    printNow: "Drucken",
    back: "Zurück zur Auswahl",
    choose: "Geräte auswählen",
    chosen: (count: number) => (count === 1 ? "1 Gerät gewählt" : `${count} Geräte gewählt`),
    chosenWithoutScript: "Die angehakten Geräte werden gedruckt.",
    noneChosen: "Bitte mindestens ein Gerät auswählen.",
    sheet: "Etikettenbogen: Avery Zweckform L7160 (A4, 21 Etiketten 63,5 × 38,1 mm)",
    /** Printed on every sticker, in both languages (decision D14) – for visitors, not only the team. */
    prompt: { de: "Problem? Scan mich!", en: "Problem? Scan me!" },
    qrCodeOf: (museumNumber: string) => `QR-Code ${museumNumber}`,
  },
  machineRecord: {
    unknown: (museumNumber: string) => `Kein Gerät mit der Museumsnummer ${museumNumber}.`,
    noSerialNumber: "keine",
    year: "Baujahr",
    manufacturer: "Hersteller",
    /** The first entry of the status history – the machine status given at registration (CONTEXT.md: Erfasst). */
    registeredAs: (status: string) => `Erfasst als ${status}`,
    retired: (date: string, who: string, reason: string) => `Ausgemustert am ${date} von ${who} – ${reason}`,
    unknownTeamMember: "unbekannt",
    changeStatus: "Status ändern",
    reportProblem: "Problem melden",
    problemReported: (museumNumber: string) => `Meldung zu ${museumNumber} erfasst – sie wartet auf die Sichtung.`,
    statusChanged: (museumNumber: string, status: string) => `${museumNumber} ist jetzt ${status}.`,
    /** Section 4 (ST-033): the machine's open defects – the same entries as the open defects list. */
    openDefects: "Offene Defekte",
    noOpenDefects: "Keine offenen Defekte.",
    /** Section 7 (ST-033): the most recent repairs, and the way to the whole repair history (G4a). */
    nothingRepaired: "An diesem Gerät wurde noch nichts repariert.",
    defectResolved: "Defekt behoben",
    wholeRepairHistory: (count: number) => `Ganze Reparaturhistorie (${count})`,
    whoAndWhen: (who: string, when: string) => `${who} · ${when}`,
  },
  /** The technician dashboard (ST-048): what needs a technician right now, in words (G6, G6a, G7). */
  technicianDashboard: {
    toTriage: "Meldungen zur Sichtung",
    waiting: (count: number, waitingLong: number) =>
      `${count === 1 ? "1 Meldung wartet" : `${count} Meldungen warten`} auf die Sichtung${
        waitingLong === 0
          ? ""
          : waitingLong === count
            ? count === 1
              ? " – länger als 3 Tage"
              : " – alle länger als 3 Tage"
            : ` – ${waitingLong} davon länger als 3 Tage`
      }.`,
    openTriage: "Zur Sichtung",
    noneToTriage: "Keine Meldung wartet auf die Sichtung.",
    toReturnToPlay: "Nicht spielbereit ohne offenen Defekt",
    withoutOpenDefects: (status: string) => `${status} · kein offener Defekt`,
    noneToReturnToPlay: "Kein Gerät wartet auf die Rückkehr ins Spiel.",
    nothingNeedsAttention: "Gerade braucht nichts deine Aufmerksamkeit.",
  },
  /** The due maintenance list (ST-043): the due tasks with their counts first, a task's machines after choosing it (G4a). */
  dueMaintenance: {
    title: "Fällige Wartung",
    counts: (machines: number, overdue: number) =>
      `${machines === 1 ? "1 Gerät" : `${machines} Geräte`}${overdue > 0 ? `, ${overdue} überfällig` : ""}`,
    lastDoneAndDue: (lastDone: string, due: string) => `Zuletzt erledigt ${lastDone} · fällig seit ${due}`,
    overdue: "Überfällig",
    nothingDue: "Gerade ist keine Wartung fällig.",
    nothingDueForHelpers: "Gerade ist keine Wartung für Helfer:innen fällig.",
    onlySuitableForHelpers: "Nur für Helfer:innen geeignet",
    filter: "Filtern",
    allDue: "Alle fälligen Wartungen",
  },
  /** Recording maintenance on a machine (ST-044): from the due maintenance list, on a form page of its own. */
  recordMaintenance: {
    record: "Wartung erfassen",
    title: (museumNumber: string) => `Wartung erfassen · ${museumNumber}`,
    outcome: "Ergebnis",
    chooseOutcome: "Bitte wählen",
    outcomes: { done: "Erledigt", "partially-done": "Teilweise erledigt" },
    date: "Datum",
    dateHint: "Heute oder bis zu 7 Tage zurück.",
    note: "Notiz (optional)",
    submit: "Wartung eintragen",
    recorded: (museumNumber: string) => `Wartung an ${museumNumber} eingetragen.`,
    unknown: "Diese Wartungsaufgabe oder dieses Gerät gibt es nicht.",
    back: "Zurück zur fälligen Wartung",
  },
  /** The maintenance plan (ST-040): its page, the form page of adding a maintenance task, and the confirmation (G3). */
  maintenancePlan: {
    add: "Wartungsaufgabe hinzufügen",
    empty: "Noch keine Wartungsaufgabe im Wartungsplan.",
    added: (name: string) => `„${name}“ ist jetzt im Wartungsplan.`,
    every: (months: number) => (months === 1 ? "Jeden Monat" : `Alle ${months} Monate`),
    onlyFor: (restriction: string) => `Nur ${restriction}`,
    allMachines: "Alle Geräte",
    startAndFirstDue: (start: string, firstDue: string) => `Start ${start} · erstmals fällig ${firstDue}`,
    name: "Name",
    instruction: "Anleitung",
    intervalMonths: "Intervall in Monaten",
    machineCategory: "Nur für Kategorie",
    technology: "Und nur für Technik",
    noRestriction: "Alle",
    startDate: "Start",
    startDateHint: "Gilt als zuletzt erledigt – fällig wird die Aufgabe ein Intervall später.",
    back: "Zurück zum Wartungsplan",
  },
  /** The repair history's own page (ST-033): the years first, each with its number of entries (G4a). */
  repairHistory: {
    title: (museumNumber: string) => `Reparaturhistorie · ${museumNumber}`,
    year: (year: string, count: number) => `${year} · ${count === 1 ? "1 Eintrag" : `${count} Einträge`}`,
    chooseYear: "Welches Jahr?",
    defectOpen: "Offen",
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
    /** After a rejection of a form that had a photo attached (G8a) – the browser cannot keep it. */
    photoAgain: "Das Foto muss erneut ausgewählt werden.",
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
  machineStatusChange: {
    title: (museumNumber: string) => `Status von ${museumNumber} ändern`,
    current: (status: string) => `Aktueller Status: ${status}`,
    reason: "Grund",
    reasonHint: "Steht in der Status-Historie, z. B. „linker Flipper schwach“.",
    submit: "Status ändern",
    retired: "Dieses Gerät ist ausgemustert – sein Status lässt sich nicht mehr ändern.",
    nothingToChange: (status: string) =>
      `Das Gerät ist bereits ${status}. Einen anderen Status können nur Techniker:innen setzen.`,
    back: "Zurück zum Gerät",
  },
  accounts: {
    title: "Teammitglieder",
    newAccount: "Neues Konto",
    name: "Name",
    username: "Benutzername",
    initialPassword: "Anfangspasswort",
    role: "Rolle",
    create: "Konto anlegen",
    created: "Konto angelegt.",
    deactivated: "deaktiviert",
    deactivate: "Deaktivieren",
    makeTechnician: "Zu Techniker:in machen",
    makeHelper: "Zu Helfer:in machen",
    newPassword: "Neues Passwort",
    resetPassword: "Passwort zurücksetzen",
    passwordReset: "Passwort neu gesetzt.",
    roleChanged: "Rolle geändert.",
    accountDeactivated: "Konto deaktiviert.",
    passwordHint: "Mindestens 10 Zeichen.",
  },
  ownPassword: {
    title: "Passwort ändern",
    current: "Aktuelles Passwort",
    new: "Neues Passwort",
    submit: "Speichern",
    changed: "Passwort geändert.",
  },
  /**
   * Texts of rejected commands of the team UI, keyed by their kebab-case error code (ST-006, the first team form).
   * Every error code of a command a team form runs needs one here – otherwise the form fails the type check.
   */
  /** Texts every form on the form runner shares (architecture review 2026-10-17). */
  forms: {
    /**
     * A change made meanwhile, on a form that keeps what was typed: its page shows the aggregate as it is now, so
     * sending again is all it takes (G8, G13) – reloading would throw the input away.
     */
    conflict: "Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.",
  },
  commandErrors: {
    /** The photo errors (ST-016), defined once in the photo module. */
    "too-large": "Das Foto ist zu groß: höchstens 20 MB.",
    "not-an-image": "Das ist kein Foto. Bitte ein Foto wählen oder es weglassen.",
    "unsupported-format":
      "Dieses Bildformat wird nicht unterstützt. Bitte ein Foto (JPEG, PNG oder WebP) wählen oder es weglassen.",
    "not-stored": "Das Foto konnte nicht gesendet werden. Bitte noch einmal versuchen oder ohne Foto melden.",
    "title-required": "Bitte einen Titel angeben.",
    "manufacturer-required": "Bitte einen Hersteller angeben.",
    "year-must-be-four-digits": "Bitte ein Baujahr mit vier Ziffern angeben, zum Beispiel 1997.",
    "machine-category-required": "Bitte eine Kategorie wählen.",
    "technology-does-not-fit-machine-category": "Diese Technik passt nicht zu dieser Kategorie.",
    /** Recording maintenance (ST-044). */
    "maintenance-task-unknown": "Diese Wartungsaufgabe gibt es nicht mehr.",
    "machine-unknown": "Dieses Gerät gibt es nicht.",
    "maintenance-task-does-not-apply": "Diese Wartungsaufgabe gilt nicht für dieses Gerät.",
    "maintenance-not-suitable-for-helpers": "Diese Wartungsaufgabe ist nicht für Helfer:innen geeignet.",
    "outcome-required": "Bitte ein Ergebnis auswählen.",
    "date-invalid": "Bitte ein gültiges Datum angeben.",
    "date-too-early": "Bitte ein Datum aus den letzten 7 Tagen angeben – nicht früher.",
    "date-in-the-future": "Das Datum darf nicht in der Zukunft liegen.",
    /** Adding a maintenance task (ST-040). */
    "name-required": "Bitte einen Namen angeben.",
    "instruction-required": "Bitte eine Anleitung angeben.",
    "interval-not-positive": "Bitte ein Intervall von mindestens 1 Monat angeben.",
    "interval-too-long": "Bitte ein Intervall von höchstens 1200 Monaten angeben.",
    "start-date-required": "Bitte ein Startdatum angeben.",
    "start-date-out-of-range": "Bitte ein Startdatum zwischen 1900 und 2999 angeben.",
    "technology-without-machine-category": "Eine Technik geht nur zusammen mit einer Kategorie.",
    "machine-model-required": "Bitte ein Modell wählen.",
    "location-required": "Bitte einen Standort angeben.",
    "machine-status-required": "Bitte einen Status wählen.",
    "museum-number-format":
      "Bitte die Museumsnummer als „LG-“ mit drei Ziffern angeben, zum Beispiel LG-042 – oder das Feld leer lassen.",
    "museum-number-taken":
      "Diese Museumsnummer ist schon vergeben. Bitte eine andere angeben oder das Feld leer lassen.",
    "machine-retired": "Dieses Gerät ist ausgemustert – daran lässt sich nichts mehr ändern oder melden.",
    "machine-not-found": "Dieses Gerät gibt es nicht.",
    "machine-not-on-display": "Dieses Gerät ist nicht ausgestellt.",
    "description-required": "Bitte beschreibe das Problem.",
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
    "helpers-only-out-of-order": "Helfer:innen können ein Gerät nur auf Außer Betrieb setzen.",
    "machine-status-unchanged": "Das Gerät hat diesen Status schon. Bitte einen anderen Status wählen.",
    "reason-required": "Bitte einen Grund angeben – er steht in der Status-Historie.",
    "no-museum-number-free":
      "Alle Museumsnummern von LG-001 bis LG-999 sind vergeben – es kann kein weiteres Gerät erfasst werden.",
    "not-authorized": "Das dürfen nur Techniker:innen.",
    "not-found": "Das gibt es nicht mehr.",
    "version-conflict": "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
  },
  /** Keyed by the kebab-case reason a Team module function rejects a change (ST-005). */
  accountErrors: {
    "not-authorized": "Das dürfen nur Techniker:innen.",
    "not-found": "Dieses Konto gibt es nicht mehr.",
    "name-required": "Bitte einen Namen angeben.",
    "username-invalid": "Benutzername: 3–30 Zeichen, nur Buchstaben, Ziffern, _ und .",
    "username-taken": "Dieser Benutzername ist schon vergeben.",
    "password-too-short": "Das Passwort braucht mindestens 10 Zeichen.",
    "last-technician": "Die letzte aktive Techniker:in muss bleiben – sonst kommt niemand mehr an die Verwaltung.",
    "current-password-wrong": "Das aktuelle Passwort stimmt nicht.",
  },
} as const;

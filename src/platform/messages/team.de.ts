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
    Location: "Standort",
    File: "Datei",
    "Problem report": "Meldung",
    Triage: "Sichtung",
    Defect: "Defekt",
    "Suitable for helpers": "Für Helfer:innen geeignet",
    "Maintenance task": "Wartungsaufgabe",
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
    /** The section with the triage outcomes on a problem report's page (G21). */
    outcomes: "Sichten",
    recordDefect: "Defekt erfassen",
    back: "Zurück zur Sichtung",
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
    alreadyTriagedBy: (name: string) => `${name} hat diese Meldung schon gesichtet.`,
    toTriage: "Zurück zur Sichtung",
    retiredMeanwhile: (museumNumber: string) =>
      `${museumNumber} ist inzwischen ausgemustert. Es wurde nichts gespeichert.`,
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
    unknown: "Diesen Defekt gibt es nicht.",
    back: "Zurück zu den Defekten",
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
  commandErrors: {
    /** The photo errors (ST-016), defined once in the photo module. */
    "too-large": "Das Foto ist zu groß: höchstens 20 MB.",
    "not-an-image": "Das ist kein Foto. Bitte ein Foto wählen oder es weglassen.",
    "unsupported-format": "Dieses Bildformat wird nicht unterstützt. Bitte ein Foto (JPEG, PNG oder WebP) wählen oder es weglassen.",
    "not-stored": "Das Foto konnte nicht gesendet werden. Bitte noch einmal versuchen oder ohne Foto melden.",
    "title-required": "Bitte einen Titel angeben.",
    "manufacturer-required": "Bitte einen Hersteller angeben.",
    "year-must-be-four-digits": "Bitte ein Baujahr mit vier Ziffern angeben, zum Beispiel 1997.",
    "machine-category-required": "Bitte eine Kategorie wählen.",
    "technology-does-not-fit-machine-category": "Diese Technik passt nicht zu dieser Kategorie.",
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
    "already-triaged": "Diese Meldung ist schon gesichtet.",
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

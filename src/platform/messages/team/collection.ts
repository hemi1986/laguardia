/**
 * The team UI's texts of the Collection context (BC-Collection): machine models, machines, the machine record,
 * QR stickers, files, machine status and location.
 */
export const collectionTexts = {
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
    /** Back on the list after creating one on its own page (ST-036, G2a, G3). */
    created: (title: string) => `Modell „${title}“ angelegt.`,
    back: "Zurück zu den Modellen",
    /** A machine model's own page and its correction (ST-036). */
    unknown: "Dieses Modell gibt es nicht.",
    noYear: "–",
    correct: "Modell korrigieren",
    correctTitle: (title: string) => `Modell „${title}“ korrigieren`,
    appliesTo: (machineCount: number) =>
      machineCount === 0
        ? "Noch kein Gerät hat dieses Modell."
        : machineCount === 1
          ? "Gilt für das eine Gerät dieses Modells."
          : `Gilt für alle ${machineCount} Geräte dieses Modells.`,
    corrected: (title: string) => `Modell „${title}“ korrigiert.`,
    backToModel: "Zurück zum Modell",
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
    /** In place of the machine status of a retired machine (user, backlog grooming 2026-10-17, ST-039). */
    retiredInPlaceOfStatus: "Ausgemustert",
    unknownTeamMember: "unbekannt",
    changeStatus: "Status ändern",
    reportProblem: "Problem melden",
    problemReported: (museumNumber: string) => `Meldung zu ${museumNumber} erfasst – sie wartet auf die Sichtung.`,
    statusChanged: (museumNumber: string, status: string) => `${museumNumber} ist jetzt ${status}.`,
    /** Section 3 (ST-034): next to the location, for every team member – not for a retired machine. */
    changeLocation: "Standort ändern",
    moved: (museumNumber: string, location: string) => `${museumNumber} steht jetzt in „${location}“.`,
    /** Section 4 (ST-033): the machine's open defects – the same entries as the open defects list. */
    openDefects: "Offene Defekte",
    noOpenDefects: "Keine offenen Defekte.",
    /** Section 7 (ST-033): the most recent repairs, and the way to the whole repair history (G4a). */
    nothingRepaired: "An diesem Gerät wurde noch nichts repariert.",
    defectResolved: "Defekt behoben",
    wholeRepairHistory: (count: number) => `Ganze Reparaturhistorie (${count})`,
    whoAndWhen: (who: string, when: string) => `${who} · ${when}`,
    /** Section 8 (ST-037): the files of the machine and its machine model, by file category (G18). */
    files: "Dateien",
    noFiles: "Noch keine Dateien zu diesem Gerät oder seinem Modell.",
    attachFile: "Datei anhängen",
    /** Next to a file of the machine model – every machine of that model shows it. */
    ofMachineModel: "Modell",
    fileAttached: (title: string) => `„${title}“ angehängt.`,
  },
  /** The file categories (CONTEXT.md: Dateikategorie) – on the machine record and the form that attaches a file (ST-037). */
  fileCategories: { manual: "Handbuch", schematic: "Schaltplan", photo: "Foto", other: "Sonstiges" },
  /** Attaching a file (ST-037) – its own page, reached from the machine record's files section. */
  attachFile: {
    title: (museumNumber: string) => `Datei an ${museumNumber} anhängen`,
    /** Strings only below – the form is a client component. */
    form: {
      file: "Datei",
      fileHint: "Höchstens 100 MB, jedes Format. PDFs und Bilder lassen sich im Browser öffnen.",
      uploading: "Wird hochgeladen … {percent} %",
      uploaded: "Hochgeladen: {fileName}",
      title: "Titel",
      fileCategory: "Dateikategorie",
      choose: "Bitte wählen",
      attachTo: "Anhängen an",
      onlyMachine: "nur {museumNumber}",
      allMachinesOfModel: "alle Geräte des Modells {machineModel}",
      submit: "Datei anhängen",
      /** After a rejection of the form: whether the chosen file is still attached (G8a, user 2026-10-18). */
      stillAttached: "Die gewählte Datei ist noch angehängt: {fileName}",
      chooseAgain: "Die Datei muss erneut ausgewählt werden.",
      tooLarge: "Dateien dürfen höchstens 100 MB groß sein.",
      notUploaded: "Die Datei konnte nicht hochgeladen werden. Bitte noch einmal auswählen.",
    },
    back: "Zurück zum Gerät",
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
  /** Moving a machine (ST-034) – its own page, reached from the machine record. */
  machineMove: {
    title: (museumNumber: string) => `Standort von ${museumNumber} ändern`,
    submit: "Standort ändern",
    unchanged: (museumNumber: string, location: string) => `${museumNumber} steht schon in „${location}“.`,
    retired: "Dieses Gerät ist ausgemustert – sein Standort lässt sich nicht mehr ändern.",
    back: "Zurück zum Gerät",
  },
} as const;

/**
 * Texts of Collection's rejected commands, keyed by their kebab-case error code (shared codes: `shared.ts`).
 */
export const collectionErrors = {
  /** Registering a machine model (ST-006) and correcting it (ST-036): no correction without a change. */
  "manufacturer-required": "Bitte einen Hersteller angeben.",
  "year-must-be-four-digits": "Bitte ein Baujahr mit vier Ziffern angeben, zum Beispiel 1997.",
  "machine-category-required": "Bitte eine Kategorie wählen.",
  "machine-model-unchanged": "Am Modell hat sich nichts geändert. Bitte etwas ändern.",
  /** Registering a machine (ST-007). */
  "machine-model-required": "Bitte ein Modell wählen.",
  "location-required": "Bitte einen Standort angeben.",
  "machine-status-required": "Bitte einen Status wählen.",
  "museum-number-format":
    "Bitte die Museumsnummer als „LG-“ mit drei Ziffern angeben, zum Beispiel LG-042 – oder das Feld leer lassen.",
  "museum-number-taken": "Diese Museumsnummer ist schon vergeben. Bitte eine andere angeben oder das Feld leer lassen.",
  "no-museum-number-free":
    "Alle Museumsnummern von LG-001 bis LG-999 sind vergeben – es kann kein weiteres Gerät erfasst werden.",
  /** Moving a machine (ST-034): no change without a change. */
  "location-unchanged": "Das Gerät steht schon dort. Bitte einen anderen Standort angeben.",
  /** Changing a machine's status (ST-012). */
  "helpers-only-out-of-order": "Helfer:innen können ein Gerät nur auf Außer Betrieb setzen.",
  "machine-status-unchanged": "Das Gerät hat diesen Status schon. Bitte einen anderen Status wählen.",
  "reason-required": "Bitte einen Grund angeben – er steht in der Status-Historie.",
  /** Attaching a file (ST-037). */
  "file-category-required": "Bitte eine Dateikategorie wählen.",
  "attach-to-required": "Bitte wählen, ob die Datei nur zu diesem Gerät oder zu allen Geräten des Modells gehört.",
} as const;

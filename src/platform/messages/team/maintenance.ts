/**
 * The team UI's texts of the Maintenance context (BC-Maintenance): due maintenance, recording it, the maintenance
 * plan.
 */
/** „kein Gerät“, „1 Gerät“, „3 Geräte“ – how many machines a maintenance task applies to. */
const devices = (count: number) => (count === 0 ? "kein Gerät" : count === 1 ? "1 Gerät" : `${count} Geräte`);

export const maintenanceTexts = {
  /** The due maintenance list (ST-043): the due tasks with their counts first, a task's machines after choosing it (G4a). */
  dueMaintenance: {
    title: "Fällige Wartung",
    counts: (machines: number, overdue: number) =>
      `${machines === 1 ? "1 Gerät" : `${machines} Geräte`}${overdue > 0 ? `, ${overdue} überfällig` : ""}`,
    lastDoneAndDue: (lastDone: string, due: string) => `Zuletzt erledigt ${lastDone} · fällig seit ${due}`,
    /** A task newly applying to a machine is due at once and has not been done there yet (ST-094). */
    dueSinceNeverDone: (due: string) => `Noch nicht erledigt · fällig seit ${due}`,
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
  /**
   * Section 5 „Wartung“ of the machine record (ST-047): the machine's due maintenance tasks and its latest maintenance
   * records; all of them on a page of their own.
   */
  machineMaintenance: {
    title: "Wartung",
    dueSince: (date: string) => `fällig seit ${date}`,
    nothingDue: "Gerade ist an diesem Gerät keine Wartung fällig.",
    notOnDisplay: "Nicht ausgestellt – es wird keine Wartung fällig.",
    records: "Wartungseinträge",
    nothingRecorded: "An diesem Gerät wurde noch keine Wartung eingetragen.",
    whoAndWhen: (who: string, when: string) => `${who} · ${when}`,
    allRecords: (count: number) => `Alle Wartungseinträge (${count})`,
    recordsTitle: (museumNumber: string) => `Wartungseinträge · ${museumNumber}`,
    year: (year: string, count: number) => `${year} · ${count === 1 ? "1 Eintrag" : `${count} Einträge`}`,
    backToMachine: "Zurück zum Gerät",
    /** How many maintenance tasks apply to the machine (ST-096) – the names are on the form page. */
    tasksApply: (count: number) =>
      count === 0
        ? "Für dieses Gerät gilt keine Wartungsaufgabe."
        : count === 1
          ? "Für dieses Gerät gilt 1 Wartungsaufgabe."
          : `Für dieses Gerät gelten ${count} Wartungsaufgaben.`,
    changeTasks: "Wartungsaufgaben ändern",
  },
  /** Changing the maintenance tasks of one machine from its machine record (ST-096, G27, G34): a form page of its own. */
  changeTasks: {
    title: (museumNumber: string) => `Wartungsaufgaben ändern · ${museumNumber}`,
    open: "Wartungsaufgaben ändern",
    legend: "Wartungsaufgaben des Geräts",
    submit: "Wartungsaufgaben ändern",
    back: "Zurück zum Gerät",
    toPlan: "Zum Wartungsplan",
    retired: "Dieses Gerät ist ausgemustert – seine Wartungsaufgaben lassen sich nicht mehr ändern.",
    /** After the name of a task: it can be done by helpers (G27). */
    suitableForHelpers: "Für Helfer:innen geeignet",
    /** The confirmation on the machine record – also when nothing changed (G33). */
    nowApply: (museumNumber: string, count: number) =>
      count === 0
        ? `Für ${museumNumber} gilt jetzt keine Wartungsaufgabe.`
        : count === 1
          ? `Für ${museumNumber} gilt jetzt 1 Wartungsaufgabe.`
          : `Für ${museumNumber} gelten jetzt ${count} Wartungsaufgaben.`,
    /** The reasons a rejected change names – nothing was stored. */
    removedMeanwhile: (names: readonly string[]) =>
      `${names.map((name) => `„${name}“`).join(", ")} ${names.length === 1 ? "ist" : "sind"} nicht mehr im Wartungsplan. Es wurde nichts gespeichert.`,
    unknown: "Diese Wartungsaufgabe gibt es nicht. Es wurde nichts gespeichert.",
  },
  /** The section „Wartungsaufgaben“ of the registration form (ST-097, G27): the tasks of a new machine. */
  registration: {
    legend: "Wartungsaufgaben",
    /** Why the ticked tasks are ticked – the machine category and technology named as in G27 („Flipper · EM“, G6a). */
    proposed: (count: number, group: string) =>
      count === 1
        ? `Vorgeschlagen: 1 Wartungsaufgabe, die schon für Geräte mit ${group} gilt.`
        : `Vorgeschlagen: ${count} Wartungsaufgaben, die schon für Geräte mit ${group} gelten.`,
  },
  /** Recording one maintenance task for several machines at once (ST-045): a selection page of its own (G4a). */
  recordForSeveral: {
    start: "Für mehrere Geräte erfassen",
    title: (name: string) => `Wartung erfassen · ${name}`,
    due: "Fällig",
    others: "Weitere Geräte",
    /** A machine to tick (ST-098): „LG-042 · Medieval Madness · Halle 1“. */
    entry: (museumNumber: string, title: string, location: string) => `${museumNumber} · ${title} · ${location}`,
    none: "Für diese Wartungsaufgabe gibt es kein Gerät.",
    submit: "Wartung eintragen",
    recorded: (name: string, count: number) =>
      `„${name}“ an ${count === 1 ? "1 Gerät" : `${count} Geräten`} eingetragen.`,
    notRecorded: (museumNumber: string, reason: string) => `${museumNumber} nicht eingetragen: ${reason}`,
    /** A machine left out that Maintenance would accept now – a command failed on the way, or the rules changed. */
    notRecordedWithoutReason: (museumNumber: string) =>
      `${museumNumber} nicht eingetragen – bitte noch einmal erfassen.`,
    /** A rejected machine no longer on the page (retired meanwhile). */
    aMachine: "Ein Gerät",
    unknown: "Diese Wartungsaufgabe gibt es nicht.",
  },
  /** The maintenance plan (ST-040): its page, the form page of adding a maintenance task, and the confirmation (G3). */
  maintenancePlan: {
    add: "Wartungsaufgabe hinzufügen",
    empty: "Noch keine Wartungsaufgabe im Wartungsplan.",
    added: (name: string) => `„${name}“ ist jetzt im Wartungsplan.`,
    changed: (name: string) => `„${name}“ geändert.`,
    removed: (name: string) => `„${name}“ ist nicht mehr im Wartungsplan.`,
    change: "Ändern",
    /** The name of the „Ändern“ link of one task on the plan, for a screen reader. */
    changeTask: (name: string) => `„${name}“ ändern`,
    /** The heading of a task's change form (G34). */
    changeTaskTitle: (name: string) => `Wartungsaufgabe ändern · ${name}`,
    save: "Wartungsaufgabe ändern",
    remove: "Wartungsaufgabe entfernen",
    removeQuestion: (name: string) =>
      `„${name}“ aus dem Wartungsplan entfernen? Sie wird nie wieder fällig; die Wartungseinträge bleiben.`,
    confirmRemove: "Endgültig entfernen",
    /** Going back from the question to the change form, with everything typed. */
    questionBack: "Zurück",
    notInPlan: "Diese Wartungsaufgabe ist nicht im Wartungsplan.",
    every: (months: number) => (months === 1 ? "Jeden Monat" : `Alle ${months} Monate`),
    /** How many machines a task applies to – a retired machine never counts (ST-094). */
    appliesTo: (count: number) => `Gilt für ${devices(count)}`,
    /** The confirmation after changing the machines of a maintenance task – also when nothing changed (ST-095, G33). */
    nowAppliesTo: (name: string, count: number) => `„${name}“ gilt jetzt für ${devices(count)}.`,
    /** The form page of changing the machines of a maintenance task (ST-095, G27, G34). */
    changeMachines: {
      open: "Geräte ändern",
      title: (name: string) => `Geräte ändern · ${name}`,
      submit: "Geräte ändern",
      back: "Zurück zur Wartungsaufgabe",
      noMachineYet: "Noch kein Gerät erfasst.",
      register: "Gerät erfassen",
    },
    name: "Name",
    instruction: "Anleitung",
    intervalMonths: "Intervall in Monaten",
    back: "Zurück zum Wartungsplan",
    /** The machines of a maintenance task, chosen in groups that fold (ST-094, G27). */
    machines: {
      title: "Geräte der Wartungsaufgabe",
      noMachineYet:
        "Noch kein Gerät erfasst. Die Wartungsaufgabe lässt sich trotzdem hinzufügen und gilt dann für kein Gerät.",
      /** After the museum number and the title: a machine that cannot become due while it is away (G27). */
      notOnDisplay: "Nicht ausgestellt",
      entry: (museumNumber: string, title: string) => `${museumNumber} · ${title}`,
      /** The reasons a rejected step names (ST-094) – nothing was stored. */
      retiredMeanwhile: (museumNumbers: readonly string[]) =>
        `${museumNumbers.length === 1 ? `${museumNumbers[0]} ist` : `${museumNumbers.join(", ")} sind`} inzwischen ausgemustert. Es wurde nichts gespeichert.`,
      unknown: "Dieses Gerät gibt es nicht. Es wurde nichts gespeichert.",
    },
  },
} as const;

/**
 * Texts of Maintenance's rejected commands, keyed by their kebab-case error code (shared codes: `shared.ts`).
 */
export const maintenanceErrors = {
  /** Recording maintenance (ST-044). */
  "maintenance-task-unknown": "Diese Wartungsaufgabe gibt es nicht mehr.",
  /** Changing the maintenance tasks of a machine (ST-096): a task was removed from the maintenance plan meanwhile. */
  "maintenance-task-removed": "Eine Wartungsaufgabe ist nicht mehr im Wartungsplan. Es wurde nichts gespeichert.",
  /** Only a forged change can choose one twice (architecture review 2026-10-28). */
  "maintenance-task-chosen-twice": "Eine Wartungsaufgabe wurde mehrfach gewählt. Es wurde nichts gespeichert.",
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
  /** Choosing the machines of a new maintenance task (ST-094) – only a forged step can choose one twice. */
  "machine-chosen-twice": "Ein Gerät wurde mehrfach gewählt. Es wurde nichts gespeichert.",
} as const;

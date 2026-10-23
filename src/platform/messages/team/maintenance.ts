/**
 * The team UI's texts of the Maintenance context (BC-Maintenance): due maintenance, recording it, the maintenance
 * plan.
 */
export const maintenanceTexts = {
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
    changed: (name: string) => `„${name}“ geändert.`,
    removed: (name: string) => `„${name}“ ist nicht mehr im Wartungsplan.`,
    change: "Ändern",
    changeTask: (name: string) => `„${name}“ ändern`,
    save: "Änderungen speichern",
    remove: "Wartungsaufgabe entfernen",
    removeQuestion: (name: string) =>
      `„${name}“ aus dem Wartungsplan entfernen? Sie wird nie wieder fällig; die Wartungseinträge bleiben.`,
    confirmRemove: "Entfernen",
    /** Going back from the question to the change form, with everything typed. */
    questionBack: "Zurück",
    notInPlan: "Diese Wartungsaufgabe ist nicht im Wartungsplan.",
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
} as const;

/**
 * Texts of Maintenance's rejected commands, keyed by their kebab-case error code (shared codes: `shared.ts`).
 */
export const maintenanceErrors = {
  /** Recording maintenance (ST-044). */
  "maintenance-task-unknown": "Diese Wartungsaufgabe gibt es nicht mehr.",
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
} as const;

/**
 * The team UI's shared texts: the domain terms – keyed by the glossary term in the `_UI (de)_` wording of
 * CONTEXT.md (a test keeps both in sync; add a term when a page first needs it) –, the navigation, and what every form
 * shares.
 */
export const sharedTexts = {
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
    "Closed on retirement": "Geschlossen (ausgemustert)",
    "Work log entry": "Arbeitsschritt",
    "Repair times": "Reparaturzeiten",
    "Time to first work log entry": "Bis zum ersten Arbeitsschritt",
    "Time to resolved": "Bis behoben",
    "Museum settings": "Museumseinstellungen",
  },
  /** The team UI's frame: the navigation (G19) and who is logged in. */
  team: {
    menu: "Navigation",
    dashboard: "Übersicht",
    more: "Mehr",
    logout: "Abmelden",
    accounts: "Teammitglieder",
    maintenance: "Wartung",
    maintenancePlan: "Wartungsplan",
    repairTimes: "Reparaturzeiten",
    machineModels: "Modelle",
    machines: "Geräte",
    triage: "Sichtung",
    defects: "Defekte",
    ownPassword: "Passwort ändern",
    /** The design switch names the design it switches to (G26, G14). */
    switchTo: { light: "Helles Design", dark: "Dunkles Design" },
  },
  /** How a page names who did something (architecture review 2026-10-25). */
  names: {
    /** A team member whose account is gone. */
    unknownTeamMember: "unbekannt",
  },
  /**
   * Choosing many out of a long list in groups that fold (G27): the machines of a maintenance task, the maintenance tasks
   * of a machine (ST-094 to ST-097), the sticker selection and recording for several machines (ST-098).
   */
  groupedChoice: {
    /** „Flipper · EM – 4 von 6 ausgewählt“; a group without a technology is named by its category alone. */
    header: (group: string, chosen: number, total: number) => `${group} – ${chosen} von ${total} ausgewählt`,
    selectAll: "Alle auswählen",
    /** A machine among the entries: „LG-042 · Medieval Madness“ – a form adds what it needs (· Halle 1, · Nicht ausgestellt). */
    machine: (museumNumber: string, machineModelTitle: string) => `${museumNumber} · ${machineModelTitle}`,
  },
  /**
   * A machine's history on a page of its own – the status history, the maintenance records, the repair history (G24,
   * architecture review 2026-10-30).
   */
  machineHistory: {
    year: (year: string, count: number) => `${year} · ${count === 1 ? "1 Eintrag" : `${count} Einträge`}`,
  },
  /** Every page of a machine (architecture review 2026-10-30): the way back to its machine record (`BackToMachine`). */
  machinePages: {
    backToMachine: "Zurück zum Gerät",
  },
  /** A list's filter form (G32, ST-092): one shape and one word on every list. */
  filters: {
    apply: "Filtern",
  },
  /** Texts every form on the form runner shares (architecture review 2026-10-17). */
  forms: {
    /**
     * A change made meanwhile, on a form that keeps what was typed: its page shows the aggregate as it is now, so
     * sending again is all it takes (G8, G13) – reloading would throw the input away.
     */
    conflict: "Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.",
    /** After a rejection of a form that had a photo attached (G8a) – the browser cannot keep it. */
    photoAgain: "Das Foto muss erneut ausgewählt werden.",
    /** The same for a form with several photos (ST-032). */
    photosAgain: "Die Fotos müssen erneut ausgewählt werden.",
  },
} as const;

/**
 * How long ago or since when, in words, after „vor“ or „seit“ (G6): under an hour, whole hours under a day, then whole
 * days – the triage list's waiting time (ST-017) and a dashboard's change lines (ST-086) count alike.
 */
export function elapsedInWords(hours: number): string {
  if (hours < 1) return "weniger als 1 Stunde";
  if (hours < 24) return `${hours} ${hours === 1 ? "Stunde" : "Stunden"}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

/**
 * Texts of rejected commands whose codes several areas produce, keyed by their kebab-case error code – an area's own
 * codes are in its file. A code a second area starts to produce moves here.
 */
export const sharedErrors = {
  /** The photo errors (ST-016), defined once in the photo module. */
  "too-large": "Das Foto ist zu groß: höchstens 20 MB.",
  "not-an-image": "Das ist kein Foto. Bitte ein Foto wählen oder es weglassen.",
  "unsupported-format":
    "Dieses Bildformat wird nicht unterstützt. Bitte ein Foto (JPEG, PNG oder WebP) wählen oder es weglassen.",
  "not-stored": "Das Foto konnte nicht gesendet werden. Bitte noch einmal versuchen oder ohne Foto melden.",
  /** Content uploaded from the browser (ST-037, ADR 0009). */
  "file-required": "Bitte eine Datei auswählen.",
  "content-gone": "Die hochgeladene Datei ist nicht mehr da.",
  /** A form run once per chosen machine with none ticked (ST-045) – the words of the sticker selection. */
  "nothing-chosen": "Bitte mindestens ein Gerät auswählen.",
  /** Collection, Repair and Maintenance. */
  "title-required": "Bitte einen Titel angeben.",
  "unknown-machine": "Dieses Gerät gibt es nicht.",
  "technology-does-not-fit-machine-category": "Diese Technik passt nicht zu dieser Kategorie.",
  "machine-retired": "Dieses Gerät ist ausgemustert – daran lässt sich nichts mehr ändern oder melden.",
  /** The command layer. */
  "not-authorized": "Das dürfen nur Techniker:innen.",
  "not-found": "Das gibt es nicht mehr.",
  "version-conflict": "Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.",
} as const;

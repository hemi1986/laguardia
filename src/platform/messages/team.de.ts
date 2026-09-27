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
    "Museum number": "Museumsnummer",
    Location: "Standort",
    File: "Datei",
    "Problem report": "Meldung",
    Triage: "Sichtung",
    Defect: "Defekt",
    "Maintenance task": "Wartungsaufgabe",
  },
  // The ST-001 spike page – removed with the spike (ST-066).
  spike: {
    password: "Spike-Passwort",
    enter: "Weiter",
    wrongPassword: "Falsches Passwort.",
    testMachineTitle: "La Guardia – Testgerät",
    files: "Dateien (Spike)",
    photos: "Fotos (Spike)",
  },
} as const;

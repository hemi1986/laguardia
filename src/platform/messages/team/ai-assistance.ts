/**
 * German texts of AI assistance's pages (ST-104: the form „KI“ on „Einstellungen“; wording decided by the user on
 * 2026-10-31 and 2026-11-01).
 */
const germanCount = (count: number) => new Intl.NumberFormat("de-DE").format(count);

export const aiAssistanceTexts = {
  /** The form „KI“ (RM-AiSettings). */
  aiSettings: {
    title: "KI",
    on: "KI ist an.",
    off: "KI ist aus.",
    missing: "Es fehlen:",
    missingParts: { key: "API-Schlüssel", "chat-model": "Chat-Modell", "embedding-model": "Embedding-Modell" },
    key: "OpenRouter-API-Schlüssel",
    savedKey: "Gespeicherter Schlüssel:",
    removeKey: "Entfernen",
    chatModel: "Chat-Modell",
    embeddingModel: "Embedding-Modell",
    chooseModel: "Bitte wählen",
    listUnavailable:
      "Die Modellliste von OpenRouter ließ sich nicht laden. Bitte die Modell-IDs eingeben, z. B. google/gemini-embedding-2.",
    /** A model in the list: „Gemini 2.5 Flash · 1.048.576 Token · 0,30 $ / 2,50 $ pro Mio. Token (Eingabe / Ausgabe)“. */
    tokens: "Token",
    perMillion: "pro Mio. Token",
    inputAndOutput: "(Eingabe / Ausgabe)",
    inputOnly: "(Eingabe)",
    doesNotFit: "passt nicht",
    spendingLimit:
      "Lege bei OpenRouter ein Ausgabenlimit für den Schlüssel fest und schalte in den Datenschutz-Einstellungen des Kontos Zero Data Retention ein und das Speichern von Prompts aus.",
    privacyNotice:
      "Beschreibungen und Fotos von Meldungen gehen an OpenRouter – erwähne das im Datenschutzhinweis (Rechtstexte).",
    save: "KI speichern",
    saved: "KI gespeichert.",
    keyRemoved: "Schlüssel entfernt. KI ist aus.",
    /** ST-110 (user, 2026-10-31). */
    replaceKey: "Ersetzen",
    newKey: "Neuer API-Schlüssel",
    keyReplaced: "Schlüssel ersetzt.",
    keyUnreadable: "Der gespeicherte Schlüssel lässt sich nicht mehr lesen. Bitte den Schlüssel erneut eingeben.",
  },
  /** The warning before the embedding model changes (ST-110, G10b's shape without „Endgültig“ and red – G30). */
  embeddingModelChange: {
    title: "Embedding-Modell wechseln",
    /** „Embedding-Modell wechseln? Alle 40 Dateien (1.200 Seiten und Bilder) werden neu …“ (user, 2026-10-31). */
    question: (files: number, pagesAndImages: number, dollars: string) =>
      [
        "Embedding-Modell wechseln?",
        files === 1
          ? `Die Datei (${germanCount(pagesAndImages)} Seiten und Bilder) wird neu für die KI erfasst.`
          : `Alle ${germanCount(files)} Dateien (${germanCount(pagesAndImages)} Seiten und Bilder) werden neu für die KI erfasst.`,
        `Geschätzte Kosten: etwa ${dollars} $.`,
        "Bis dahin findet die KI nur die schon neu erfassten Dateien.",
      ].join(" "),
    confirm: "Embedding-Modell wechseln",
    back: "Zurück",
  },
  /** The overview „KI-Erfassung“ in the form „KI“ (RM-AiSettings, ST-109; wording decided by the user on 2026-10-31). */
  aiIndex: {
    title: "KI-Erfassung",
    /** „12 Dateien für die KI erfasst · 3 warten auf KI-Erfassung · 2 für die KI nicht lesbar“ – German numbers (G13). */
    counts: (indexed: number, waiting: number, failed: number) =>
      [
        `${germanCount(indexed)} ${indexed === 1 ? "Datei" : "Dateien"} für die KI erfasst`,
        `${germanCount(waiting)} ${waiting === 1 ? "wartet" : "warten"} auf KI-Erfassung`,
        `${germanCount(failed)} für die KI nicht lesbar`,
      ].join(" · "),
    cost: (dollars: string) => `Kosten der KI-Erfassung bisher: ${dollars} $`,
    empty: "Noch keine Datei für die KI erfasst.",
    failedFile: (owner: string, title: string, reason: string) => `${owner} · ${title} – ${reason}`,
    failureReasons: {
      "not readable": "Datei lässt sich nicht lesen",
      "format not indexed": "Dateiformat wird nicht erfasst",
      "OpenRouter refused": "OpenRouter hat abgelehnt",
      "OpenRouter not reachable": "OpenRouter war nicht erreichbar",
      "broken off": "Erfassung abgebrochen",
    },
    retry: "Erneut versuchen",
    retrying: (title: string) => `${title} wird erneut für die KI erfasst.`,
    /** The mark on the machine record's list of files (RM-MachineRecord). */
    unreadable: "Für die KI nicht lesbar",
  },
  /** The section „KI-Einschätzungen“ on a defect's page and its request form (RM-DefectAiAssessments, ST-107). */
  aiAssessments: {
    title: "KI-Einschätzungen",
    empty:
      "Noch keine KI-Einschätzung. Die KI liest den Defekt, die Meldungen und Arbeitsschritte und die Dateien des Geräts und schlägt vor, was zuerst zu prüfen ist.",
    request: "KI-Einschätzung anfordern",
    requestTitle: (defectTitle: string) => `KI-Einschätzung anfordern · ${defectTitle}`,
    note: "Was hast du beobachtet / was willst du wissen? (freiwillig)",
    photos: (atMost: number) => `Fotos (freiwillig, höchstens ${atMost})`,
    hint: "Gesendet werden der Defekt mit Meldungen, Fotos und Arbeitsschritten, die letzten behobenen Defekte des Geräts und passende Stellen aus den Dateien des Geräts und seines Modells.",
    running: "KI-Einschätzung läuft …",
    runningHint: "Die Seite aktualisiert sich von selbst.",
    summary: "Zusammenfassung",
    probableCauses: "Wahrscheinliche Ursachen",
    whatToCheckFirst: "Zuerst prüfen",
    references: "Fundstellen",
    referenceWithPage: (title: string, page: number) => `${title}, S. ${page}`,
    line: (model: string, at: string, by: string, cost: string) =>
      `KI-Einschätzung · ${model} · ${at} · angefordert von ${by} · ${cost}`,
    failed: (reason: string) => `KI-Einschätzung fehlgeschlagen: ${reason}`,
    retry: "Erneut versuchen",
    photoAlt: "Foto der KI-Einschätzung",
    photosField: {
      full: (atMost: number) => `${atMost} Fotos ausgewählt – mehr gehen nicht.`,
      take: "Foto aufnehmen",
      choose: "Fotos auswählen",
      remove: "Foto entfernen",
      preparing: "Fotos werden vorbereitet …",
    },
    failureReasons: {
      "key-invalid":
        "OpenRouter hat den API-Schlüssel abgelehnt. Techniker:innen können ihn unter Einstellungen ersetzen.",
      "credit-used-up": "Das Guthaben bei OpenRouter ist aufgebraucht.",
      "model-not-available": "Das Chat-Modell ist bei OpenRouter gerade nicht ohne Datenspeicherung verfügbar.",
      "timed-out": "Die KI hat nicht rechtzeitig geantwortet.",
      "openrouter-not-reachable": "OpenRouter war nicht erreichbar.",
      "ai-off": "Die KI wurde inzwischen ausgeschaltet.",
      "answer-unusable": "Die Antwort der KI war unbrauchbar.",
      "broken-off": "Die Arbeit daran wurde abgebrochen, bevor sie fertig war.",
    },
  },
} as const;

/** Texts of CMD-ChangeAiSettings' rejections (ST-104), keyed by their kebab-case error code. */
export const aiAssistanceErrors = {
  "ai-key-refused": "OpenRouter hat den Schlüssel abgelehnt. Bitte den Schlüssel prüfen und erneut eingeben.",
  "openrouter-unreachable":
    "OpenRouter ist gerade nicht erreichbar. Es wurde nichts gespeichert – bitte später erneut speichern.",
  "chat-model-unknown": "OpenRouter kennt dieses Modell nicht.",
  "embedding-model-unknown": "OpenRouter kennt dieses Modell nicht.",
  "chat-model-reads-no-images": "Dieses Modell liest keine Bilder. Bitte ein Modell wählen, das Text und Bilder liest.",
  "embedding-model-reads-no-images":
    "Dieses Modell liest keine Bilder. Bitte ein Modell wählen, das Text und Bilder liest.",
  "embedding-model-wrong-size":
    "Dieses Embedding-Modell passt nicht zur KI-Erfassung (es liefert keine 1536 Werte). Bitte ein anderes wählen.",
  "embedding-model-change-unconfirmed":
    "Bitte den neuen Schlüssel zuerst allein speichern und danach das Embedding-Modell wechseln.",
  "embedding-model-needs-key":
    "Das Embedding-Modell lässt sich nur mit dem API-Schlüssel prüfen. Bitte den Schlüssel mit eingeben.",
  "ai-assessment-ai-off": "Die KI ist ausgeschaltet. Eine KI-Einschätzung gibt es nur, solange KI an ist.",
  "ai-assessment-defect-not-open": "Eine KI-Einschätzung gibt es nur für offene Defekte.",
  "ai-assessment-not-allowed-for-helpers":
    "Diese KI-Einschätzung ist nur für Techniker:innen – der Defekt ist nicht für Helfer:innen geeignet.",
  "ai-assessment-being-written": "Für diesen Defekt läuft schon eine KI-Einschätzung.",
  "ai-assessment-too-many-photos": "Bitte höchstens 5 Fotos mitschicken.",
  "file-indexing-ai-off": "Die KI ist ausgeschaltet. Dateien werden nur für die KI erfasst, solange KI an ist.",
  "file-indexing-not-failed": "Diese Datei ist inzwischen nicht mehr als nicht lesbar vermerkt – sie wird nicht erneut erfasst.",
} as const;

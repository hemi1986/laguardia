/**
 * German texts of AI assistance's pages (ST-104: the form „KI“ on „Einstellungen“; wording decided by the user on
 * 2026-10-31 and 2026-11-01).
 */
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
  "embedding-model-needs-key":
    "Das Embedding-Modell lässt sich nur mit dem API-Schlüssel prüfen. Bitte den Schlüssel mit eingeben.",
  "ai-assessment-ai-off": "Die KI ist ausgeschaltet. Eine KI-Einschätzung gibt es nur, solange KI an ist.",
  "ai-assessment-defect-not-open": "Eine KI-Einschätzung gibt es nur für offene Defekte.",
  "ai-assessment-not-allowed-for-helpers":
    "Diese KI-Einschätzung ist nur für Techniker:innen – der Defekt ist nicht für Helfer:innen geeignet.",
  "ai-assessment-being-written": "Für diesen Defekt läuft schon eine KI-Einschätzung.",
  "ai-assessment-too-many-photos": "Bitte höchstens 5 Fotos mitschicken.",
} as const;

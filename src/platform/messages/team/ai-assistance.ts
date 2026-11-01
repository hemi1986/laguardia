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
} as const;

/** Texts of CMD-ChangeAiSettings' rejections (ST-104), keyed by their kebab-case error code. */
export const aiAssistanceErrors = {
  "ai-key-refused": "OpenRouter hat den Schlüssel abgelehnt. Bitte den Schlüssel prüfen und erneut eingeben.",
  "openrouter-unreachable": "OpenRouter ist gerade nicht erreichbar. Es wurde nichts gespeichert – bitte später erneut speichern.",
  "chat-model-unknown": "OpenRouter kennt dieses Modell nicht.",
  "embedding-model-unknown": "OpenRouter kennt dieses Modell nicht.",
  "chat-model-reads-no-images": "Dieses Modell liest keine Bilder. Bitte ein Modell wählen, das Text und Bilder liest.",
  "embedding-model-reads-no-images":
    "Dieses Modell liest keine Bilder. Bitte ein Modell wählen, das Text und Bilder liest.",
  "embedding-model-wrong-size":
    "Dieses Embedding-Modell passt nicht zur KI-Erfassung (es liefert keine 1536 Werte). Bitte ein anderes wählen.",
  "embedding-model-needs-key":
    "Das Embedding-Modell lässt sich nur mit dem API-Schlüssel prüfen. Bitte den Schlüssel mit eingeben.",
} as const;

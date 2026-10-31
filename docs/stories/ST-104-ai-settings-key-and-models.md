---
id: ST-104
title: AI settings – the OpenRouter key and the two models on „Einstellungen“
type: story
context: BC-AiAssistance
priority: should
size: L
risk: medium
events: [EVT-AiSettingsChanged]
depends_on: []
labels: [ui, feature:ai-assessment]
status: ready
---

## Story
As a technician, I want to save the museum's OpenRouter API key and choose the chat model and the embedding model on the settings page, so that the team can ask an AI for help with open defects – and so that I can turn it off again.

## Context
Feature `ai-assessment` (user, `/feature` grilling and focused event storming 2026-10-31; `docs/domain/events.yaml`
**AGG-AiSettings**, **CMD-ChangeAiSettings**, **EVT-AiSettingsChanged**, **RM-AiSettings**, **RM-MuseumSettings**,
resolved **HS-34**, **FLOW-AiAssessment**; `docs/architecture/data-model.md`, section *AI settings*;
`docs/adr/0014-ai-through-openrouter-with-a-multimodal-index-in-postgresql.md`; `docs/domain/context-map.md`,
*OpenRouter → AI assistance*). First story of the feature: it only records the AI settings – nothing is indexed and
nothing is sent to the chat model yet (ST-106, ST-107). Revised after the story review
`docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31).

**The page is renamed (G19 row 9a).** The technicians' page built by ST-100 as „Museumseinstellungen“ is now
**„Einstellungen“** (`CONTEXT.md`: *Settings*): its entry under „Mehr“ – same place, technicians only – and its heading.
Its sections, each framed with its title and saved on its own (G18, G29): „Museum“, „Logo“, „Rechtstexte“ (unchanged,
ST-100, ST-102, ST-103) and, last, the new **„KI“**. ST-100, ST-102 and ST-103 are `done` and not reopened: their tests
that assert the old label (`e2e/museum-settings.spec.ts`) follow the new label as part of this story – a rename, not a
weakening; **the titles of those tests stay unchanged**. The comment in `src/app/(team)/navigation.tsx` and the
catalog's glossary term for the page are brought in line with `CONTEXT.md` (*Settings* „Einstellungen“; *Museum
settings* has no page title of its own any more – its `_UI (de)_` line in `CONTEXT.md` still says „Museumseinstellungen“
until this story and changes with the catalog, as its `_Note_` says).

**The form „KI“** – `CMD-ChangeAiSettings`, technicians only (ACT-Technician):
- **AI is on exactly while a key, a chat model and an embedding model are saved** (invariant). Until a technician saves
  anything the AI settings hold no key and no models (singleton, never created – invariant *exactly one AI
  settings*). The form says whether AI is on and, while it is off, what is missing (G37).
- **A part that is not saved yet can always be chosen or entered; only a saved part is shown without a change until
  ST-110** (stopgap, story review 2026-10-31). So a technician who saved only a key – or only the models – can complete
  the AI settings with a second save. A wrongly chosen saved model can only be corrected once ST-110 is built; AI is
  unused before the feature is done, so this is accepted.
- **The key (G36):** a new key is checked with OpenRouter before it is saved; a key OpenRouter refuses is rejected and
  nothing is saved (rule). If OpenRouter cannot be reached for the check, the save is rejected too and nothing is
  saved. Once saved, the key is shown only as its last four characters („…a1b2“) – never again in a page, a message, a
  link, the journal or a log (invariant *never shown or handed out again*); it is kept encrypted (ADR 0014). The key
  field is empty after every save and every rejection (G36, G8). **A saved key that cannot be decrypted counts as no
  key** from this story on (the environment's encryption key missing or changed, ADR 0014); ST-110 tests it.
- **The models:** chosen from the list OpenRouter offers when the form is opened, each with its name, context size
  and price per million tokens (RM-AiSettings); when the list cannot be loaded, the model ID is typed by hand (rule).
  The chat model must read text and images, and so must the embedding model (rule). The embedding model must return
  1536 numbers, natively or on request – one test embedding on saving checks it (one short text, so it costs next to
  nothing). A model that does not fit is offered in the list marked „· passt nicht“ and cannot be chosen (HS-34); a
  model typed by hand is checked the same way on saving and rejected if it does not fit.
- **Removing the key** („Entfernen“) turns AI off and keeps the chosen models (data model, lifecycle *On → Off*);
  nothing else is removed. It is **one tap without a question page** – the key can be saved again, and the
  confirmation names the consequence (G10c's reasoning; user, 2026-10-31).
- **Version check:** if someone changed the AI settings meanwhile, the save is rejected with the usual team text
  „Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“ (rule) – the key field
  stays empty (G36). The AI settings are one part with one version, apart from the three parts of the museum settings
  (data model).
- **Reminders on the form** (RM-AiSettings, ADR 0014): set a spending limit on the key at OpenRouter; turn on zero data
  retention and turn off prompt logging in the OpenRouter account's privacy settings; the privacy notice has to
  mention that problem report descriptions and photos reach the AI (`docs/product/vision.md`, Constraints – the
  technicians change it in „Rechtstexte“).
- Every rejection names the reason at the field (G8, G9) and keeps the chosen models.
- The journal names what changed (key saved, key removed, chat model, embedding model), the key's last four
  characters and who changed it – never the key (EVT-AiSettingsChanged).

**Permission (G11):** helpers do not reach „Einstellungen“ (as ST-100); the command refuses a helper anyway.

**German texts** (user, 2026-10-31, as recommended in the story review):
- Labels „OpenRouter-API-Schlüssel“, „Chat-Modell“, „Embedding-Modell“ – this settles the labels `CONTEXT.md` lists
  as proposals for *Chat model* and *Embedding model*.
- A chat model in the list: „Gemini 2.5 Flash · 1.048.576 Token · 0,30 $ / 2,50 $ pro Mio. Token (Eingabe /
  Ausgabe)“; an embedding model shows one price only: „Gemini Embedding 2 · … Token · 0,15 $ pro Mio. Token
  (Eingabe)“; a model that does not fit ends in „· passt nicht“.
- State „KI ist an.“ / „KI ist aus. Es fehlen: API-Schlüssel, Chat-Modell, Embedding-Modell.“ (only what is missing).
- Saved key „Gespeicherter Schlüssel: …a1b2“ with „Ersetzen“ (ST-110) and „Entfernen“.
- Without the list: „Die Modellliste von OpenRouter ließ sich nicht laden. Bitte die Modell-IDs eingeben, z. B.
  google/gemini-embedding-2.“
- Rejections: „OpenRouter hat den Schlüssel abgelehnt. Bitte den Schlüssel prüfen und erneut eingeben.“,
  „OpenRouter ist gerade nicht erreichbar. Es wurde nichts gespeichert – bitte später erneut speichern.“, „Dieses
  Modell liest keine Bilder. Bitte ein Modell wählen, das Text und Bilder liest.“, „Dieses Embedding-Modell passt
  nicht zur KI-Erfassung (es liefert keine 1536 Werte). Bitte ein anderes wählen.“, „OpenRouter kennt dieses Modell
  nicht.“
- Reminders: „Lege bei OpenRouter ein Ausgabenlimit für den Schlüssel fest und schalte in den
  Datenschutz-Einstellungen des Kontos Zero Data Retention ein und das Speichern von Prompts aus.“ and „Beschreibungen
  und Fotos von Meldungen gehen an OpenRouter – erwähne das im Datenschutzhinweis (Rechtstexte).“
- Button „KI speichern“, confirmation „KI gespeichert. KI ist an.“ (or „KI gespeichert.“ while something is still
  missing); after „Entfernen“ „Schlüssel entfernt. KI ist aus.“

**Interface:** usual page width (G16), German team wording (G12, G13), buttons that say what they do (G14), a saved
secret only as its last four characters with „Ersetzen“ / „Entfernen“ (G36 – „Ersetzen“ arrives with ST-110).

**Definition of done** (not scenarios):
1. ADR 0014 is accepted by the user before this story is built.
2. `docs/operations/` gets the step to create `AI_SETTINGS_ENCRYPTION_KEY` per environment (32 random bytes, base64 –
   locally, on previews and in production), and what happens when it is missing or changed (ADR 0014).
3. The pull request goes through the normal review lane plus `/security-review` – the first secret a person enters in
   La Guardia.
4. The seam catalog in `docs/engineering/conventions.md` gets the **AI seam** with its in-memory
   adapter for tests, and how the OpenRouter adapter itself is tested – neither is in the catalog yet. Seams outside
   the catalog this story needs, decided by the user in the test plan: the AI seam, the OpenRouter adapter against a
   fake HTTP server (new), the key encryption (unit test at the pure encrypt/decrypt function).

## Acceptance Criteria

Scenario: Technicians reach „Einstellungen“ under „Mehr“
  Given a technician is logged in
  When the technician opens „Mehr“ in the team navigation
  Then „Einstellungen“ is offered where „Museumseinstellungen“ was, and „Museumseinstellungen“ is not
  And the page it opens is headed „Einstellungen“ with the sections „Museum“, „Logo“, „Rechtstexte“ and „KI“ in that order

Scenario: With nothing saved AI is off, and a missing part can still be added
  Given no technician has changed the AI settings yet
  When a technician opens „Einstellungen“
  Then the form „KI“ says that AI is off and that the key, the chat model and the embedding model are missing, and shows no key
  And after a save of only a key ending in "a1b2" that OpenRouter accepts, AI is still off and the form says that both models are missing
  And the key is then shown only as „…a1b2“ without a change offered, while both models can still be chosen
  And saving both models afterwards turns AI on with the key „…a1b2“

Scenario: A technician turns AI on with a key and two models from OpenRouter's list
  Given AI is off
  And OpenRouter offers the chat model "Gemini 2.5 Flash" and the embedding model "Gemini Embedding 2", each shown with its context size and price per million tokens
  When a technician enters a key ending in "a1b2" that OpenRouter accepts, chooses both models and saves the form „KI“
  Then the form „KI“ says that AI is on, with the chosen chat model and embedding model
  And the key is shown only as „…a1b2“ and the key field is empty
  And the form reminds to set a spending limit on the key at OpenRouter and to mention the AI in the privacy notice
  And the change names the technician, and neither the page nor the journal contains the key

Scenario: A key OpenRouter refuses is rejected
  Given AI is off
  When a technician enters a key OpenRouter refuses, chooses both models and saves the form „KI“
  Then the save is rejected at the key with a reason saying OpenRouter refused the key
  And the chosen models are still selected and the key field is empty
  And AI is still off and no key is saved

Scenario: Models that do not fit are offered in the list but cannot be chosen
  Given OpenRouter offers the chat models "Gemini 2.5 Flash" and "Text Chat", which reads text only
  And it offers the embedding models "Gemini Embedding 2", "Text Embedding", which reads text only, and "Small Embedding", which returns 768 numbers
  When a technician opens the form „KI“
  Then "Text Chat", "Text Embedding" and "Small Embedding" are listed marked as not fitting and cannot be chosen
  And "Gemini 2.5 Flash" and "Gemini Embedding 2" can be chosen
  And a form „KI“ sent with "Text Chat" as the chat model anyway is rejected at the chat model and saves nothing

Scenario Outline: Without OpenRouter's model list a typed model that does not fit is rejected
  Given OpenRouter's model list cannot be loaded and AI is off
  When a technician saves the form „KI“ with an accepted key, <model> typed as the <field> and a fitting model typed as the other one
  Then the save is rejected at the <field> with a reason saying <reason>
  And both typed model IDs are still in the form and the key field is empty
  And AI is still off

  Examples:
    | model                                     | field           | reason                                      |
    | "text/chat", which reads text only         | chat model      | the model must read text and images         |
    | "text/embedding", which reads text only    | embedding model | the model must read text and images         |
    | "small/embedding", which returns 768 numbers | embedding model | the embedding model does not fit the AI index |

Scenario: Without OpenRouter's model list the models are typed by hand
  Given OpenRouter's model list cannot be loaded
  When a technician opens the form „KI“
  Then the form says that the list could not be loaded and asks for the model IDs
  And saving with an accepted key, "google/gemini-2.5-flash" and "google/gemini-embedding-2" typed turns AI on

Scenario: Removing the key turns AI off
  Given AI is on with a key ending in "a1b2"
  When a technician removes the key with one tap
  Then the form „KI“ confirms that the key was removed and says that AI is off and that the key is missing
  And the chat model and the embedding model are still saved
  And the change names the technician

Scenario: AI settings changed by someone else meanwhile are not overwritten
  Given a technician opened „Einstellungen“ while AI was off
  And another technician then saved a key and both models
  When the first technician saves the form „KI“ with other models and a key
  Then the save is rejected with „Jemand hat das inzwischen geändert. Deine Eingabe ist noch da – bitte noch einmal senden.“
  And the models the first technician chose are still selected and the key field is empty
  And the AI settings are the ones the other technician saved

Scenario: Helpers do not get the AI settings
  Given a helper is logged in
  When the helper opens the address of „Einstellungen“
  Then the page is not shown, as on every technician-only page
  And „Mehr“ does not offer „Einstellungen“ to the helper
  And a form „KI“ sent by the helper is rejected and changes nothing

## Out of Scope
- Indexing the files (ST-106) and asking for an AI assessment (ST-107)
- Replacing a saved key, changing a saved model – with the warning and cost estimate for the embedding model – and a
  save without a change (ST-110). Until ST-110 is built, a saved part is shown without offering a change; a part that
  is not saved yet can always be chosen or entered, and after the key is removed a new key is saved as here.
- Testing a saved key that can no longer be decrypted (ST-110; the state exists from this story on)
- The overview of the AI index on the form (ST-109)
- Showing who changed the AI settings and when (journal only)

## Open Questions
- none – the wording and the one-tap „Entfernen“ were answered by the user on 2026-10-31 (`docs/stories/OPEN_QUESTIONS.md`, ST-104).

## Notes
- Implementation order of the feature (user, 2026-10-31): ST-104 → ST-105 (spike) → ST-112 (background work) → ST-106 →
  ST-107 → ST-108 → ST-109 → ST-110 → ST-111; `depends_on` carries the real dependencies.
- OpenRouter is an external system behind the AI seam (ADR 0014); the scenarios describe behaviour, the tests use the
  seam's in-memory stand-in.

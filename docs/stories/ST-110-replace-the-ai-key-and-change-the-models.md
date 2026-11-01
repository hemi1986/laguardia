---
id: ST-110
title: Replace the AI key and change the models, with a cost warning for the embedding model
type: story
context: BC-AiAssistance
priority: should
size: M
risk: medium
events: [EVT-AiSettingsChanged, EVT-FileIndexedForAi]
depends_on: [ST-104, ST-106]
labels: [ui, feature:ai-assessment]
status: done
---

## Story
As a technician, I want to replace the OpenRouter key and change the chat model or the embedding model once AI is on – warned what re-indexing will cost before it starts – so that I can switch to a better or cheaper model without surprises on the bill.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **AGG-AiSettings**, **CMD-ChangeAiSettings**,
**EVT-AiSettingsChanged**, **POL-AiIndexFollowsTheSettings**, **RM-AiSettings**, **HS-27** as precedent;
`docs/architecture/data-model.md`, sections *AI settings* and *AI index entry*; ADR 0014). Extends the form „KI“ of
ST-104, whose checks of a key and of a model apply unchanged to every change here. Revised after the story review
`docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31).

**Replacing the key (G36):** „Ersetzen“ next to the saved key („…a1b2“) offers an empty field for a new key; the new
key is checked with OpenRouter before it is saved, a refused one is rejected and the saved key stays (rule). AI stays
on and nothing is indexed again.

**A saved key that can no longer be decrypted** (the environment's encryption key missing or changed, ADR 0014)
counts as no key: AI is off and the form asks for the key again. The state exists since ST-104; it is tested here.

**Changing the chat model** applies to AI assessments requested from then on; an AI assessment keeps the chat model it
was requested with (invariant of AGG-AiAssessment). Nothing is indexed again.

**Changing the embedding model** (rule): confirmed only after a **warning that every file is indexed again, with an
estimate of the cost**. The estimate is
**pages and images of the current AI index entries × tokens per page or image × the new model's price per million
tokens**, where *tokens per page or image* is a constant measured by the spike ST-105 (a PDF page's text passage
included) – for example 1.200 pages and images × 2.500 tokens = 3.000.000 tokens at 0,20 $ per million tokens is
about 0,60 $ (ADR 0014, *Consequences*). Going back from the warning changes nothing. Confirmed, every file is indexed
again with the new model in the background (POL-AiIndexFollowsTheSettings, ADR 0015); until a file is indexed again it
counts as waiting, and an AI assessment searches only entries made with the current embedding model
(CMD-WriteAiAssessment) – an entry made with the earlier model stays until it is replaced but is never searched (data
model). The same holds for an indexing that started with the earlier model and stores its entry after the change: that
entry is never searched and the file stays waiting until it is indexed with the new model (waiting is derived from the
current embedding model, data model). The new embedding model is checked for 1536 numbers as in ST-104 (HS-34). The
warning is a page of its own, because it must work without JavaScript (G10b's shape), without „Endgültig“ and without
red (G30) – nothing is lost.

**Saving without a change** records no event and is no rejection – the form lands like a save (rule, as HS-27; G33).

The version check, the reminders and the rejections' kept input are ST-104's and apply unchanged.

**German texts** (user, 2026-10-31, as recommended): „Ersetzen“ opens the field „Neuer API-Schlüssel“, confirmation
„Schlüssel ersetzt.“; the warning „Embedding-Modell wechseln? Alle 40 Dateien (1.200 Seiten und Bilder) werden neu für
die KI erfasst. Geschätzte Kosten: etwa 0,60 $. Bis dahin findet die KI nur die schon neu erfassten Dateien.“ with
„Embedding-Modell wechseln“ / „Zurück“; a key that can no longer be read „Der gespeicherte Schlüssel lässt sich nicht
mehr lesen. Bitte den Schlüssel erneut eingeben.“; unchanged save „KI gespeichert.“ (G33).

**Definition of done** (not scenarios): the normal review lane plus `/security-review` – the diff replaces a saved
secret.

## Acceptance Criteria

Scenario: A technician replaces the key
  Given AI is on with a key ending in "a1b2"
  When a technician replaces it with a key ending in "c3d4" that OpenRouter accepts
  Then the form „KI“ shows the key only as „…c3d4“ and AI is still on
  And no file is indexed again
  And the change names the technician, and neither the page nor the journal contains either key

Scenario: A replacement key OpenRouter refuses keeps the saved key
  Given AI is on with a key ending in "a1b2"
  When a technician replaces it with a key OpenRouter refuses
  Then the replacement is rejected at the key with a reason saying OpenRouter refused the key
  And the key field is empty
  And the saved key is still „…a1b2“ and AI is still on

Scenario: A saved key that can no longer be read turns AI off
  Given AI is on with a saved key
  And the environment's encryption key has changed since the key was saved
  When a technician opens „Einstellungen“
  Then the form „KI“ says that AI is off and asks for the key again
  And „KI-Einschätzung anfordern“ is offered on no defect

Scenario: A new chat model applies to the next AI assessments only
  Given AI is on with the chat model "Gemini 2.5 Flash" and a written AI assessment of "Left flipper weak"
  When a technician changes the chat model to "Claude Sonnet 4.5"
  Then the next AI assessment is written with "Claude Sonnet 4.5"
  And the earlier AI assessment still names "Gemini 2.5 Flash"
  And no file is indexed again

Scenario: Changing the embedding model warns what indexing again will cost
  Given AI is on and the AI index holds 40 files with 1.200 pages and images
  And a page or image is estimated at 2.500 tokens
  When a technician chooses the embedding model "Other Embedding", priced at 0,20 $ per million tokens, and saves the form „KI“
  Then a warning says that all 40 files with 1.200 pages and images will be indexed again, at an estimated cost of about 0,60 $
  And the embedding model is not changed yet

Scenario: Going back from the warning changes nothing
  Given the warning about changing the embedding model is shown
  When the technician goes back
  Then the embedding model is unchanged and nothing is indexed again
  And the form „KI“ still holds the other embedding model the technician chose

Scenario: A confirmed embedding model indexes every file again
  Given AI is on and "Eight Ball Manual" and "Eight Ball Schematic" are indexed with "google/gemini-embedding-2"
  When a technician confirms the change to another embedding model
  Then both files count as waiting until they are indexed with the new model
  And an AI assessment written meanwhile finds only files already indexed with the new model
  And both files are indexed with the new model afterwards

Scenario: An indexing with the earlier embedding model that ends after the change still counts as waiting
  Given AI is on with "google/gemini-embedding-2" and "Wiring notes" is being indexed with it
  When a technician confirms the change to another embedding model before that indexing ends
  Then "Wiring notes" counts as waiting for the new model once that indexing has ended
  And an AI assessment written meanwhile does not find "Wiring notes"
  And "Wiring notes" is indexed with the new model afterwards

Scenario: Saving without a change records nothing
  Given AI is on with a key ending in "a1b2" and two saved models
  When a technician saves the form „KI“ without changing anything
  Then the form shows the same settings with the confirmation „KI gespeichert.“
  And no change of the AI settings is recorded and nothing is indexed again

## Out of Scope
- Changing the size of the AI index's embeddings (1536 numbers, HS-34)
- Keeping the AI index of the earlier embedding model searchable alongside the new one
- Setting or reading the spending limit at OpenRouter from La Guardia (the form only reminds, ST-104)

## Open Questions
- none – the German texts were answered by the user on 2026-10-31 (`docs/stories/OPEN_QUESTIONS.md`, ST-110).

## Notes
- Built after ST-109 although it only needs ST-104 and ST-106 (implementation order of the feature, user 2026-10-31).
  Until then ST-104's form offers no change of a saved part and no „Ersetzen“; a part not saved yet can always be
  added, and removing the key and saving a new one works from ST-104 on.
- The tokens-per-item constant comes from ST-105; the 2.500 in the scenario is a test value, not the measured figure. Measured by ST-105 (2026-11-01, `google/gemini-embedding-2`): a page image 258 tokens, a PDF page's text passage 274 on average – so a PDF page ≈ 530 tokens, an image 258.
- Entries of the earlier embedding model stay until they are replaced – storage grows meanwhile; accepted (story review
  2026-10-31, section 5).

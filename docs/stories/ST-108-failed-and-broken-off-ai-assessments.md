---
id: ST-108
title: An AI assessment that fails or breaks off says why and can be tried again
type: story
context: BC-AiAssistance
priority: should
size: L
risk: high
events: [EVT-AiAssessmentFailed, EVT-AiAssessmentWritten, EVT-AiAssessmentRequested, EVT-AiWorkLeftUnfinished]
depends_on: [ST-107]
labels: [ui, feature:ai-assessment]
status: ready
---

## Story
As a team member who asked for an AI assessment, I want to see in plain German why it failed and to try again – and never to find it stuck – so that I know whether to wait, ask again or tell a technician.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **AGG-AiAssessment**, **CMD-WriteAiAssessment**,
**CMD-RequestAiAssessment**, **EVT-AiAssessmentFailed**, **EVT-AiWorkLeftUnfinished**,
**POL-UnfinishedAiWorkIsRetried**, **RM-DefectAiAssessments**, resolved **HS-30**, **HS-33**; ADR 0014; ADR 0015;
`docs/domain/context-map.md`, *OpenRouter → AI assistance*). The special cases of ST-107. Revised after the story review
`docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31).

**A failed AI assessment (G35)** shows in the section „KI-Einschätzungen“ as „KI-Einschätzung fehlgeschlagen:
<Grund>“ with **„Erneut versuchen“**. The reason is one fixed German text per kind (EVT-AiAssessmentFailed, data model
`AssessmentFailureReason`; user, 2026-10-31):

| Reason | German text |
|---|---|
| *key invalid* | „OpenRouter hat den API-Schlüssel abgelehnt. Techniker:innen können ihn unter Einstellungen ersetzen.“ |
| *credit used up* | „Das Guthaben bei OpenRouter ist aufgebraucht.“ |
| *model not available* (also: no provider for the chat model that neither keeps nor trains on the data, ADR 0014) | „Das Chat-Modell ist bei OpenRouter gerade nicht ohne Datenspeicherung verfügbar.“ |
| *timed out* | „Die KI hat nicht rechtzeitig geantwortet.“ |
| *OpenRouter not reachable* | „OpenRouter war nicht erreichbar.“ |
| *AI off* | „Die KI wurde inzwischen ausgeschaltet.“ |
| *answer unusable* | „Die Antwort der KI war unbrauchbar.“ |

**Never OpenRouter's own text** – the anti-corruption layer turns every answer into one of these reasons (context map).
A failed AI assessment is a state of the page, not a rejection of a form (G35), and it is kept with the defect like a
written one (`CONTEXT.md`: *AI assessment*; invariant – written or failed exactly once, then never changed).

**An unusable answer** (rule; user, 2026-10-31, story review): references to files outside the defect's machine and its
machine model are dropped (ST-107); an answer that is empty, cannot be read as an AI assessment or has no usable summary
fails the AI assessment with the reason *answer unusable*.

**„Erneut versuchen“** is a new AI assessment (CMD-RequestAiAssessment) **in one tap, with the failed one's note and
photos** – no request form (user, 2026-10-31). The failed one stays as it is. Both AI assessments then refer to the same
stored photos; that is safe because the photos of an AI assessment never change (invariant) and are never deleted
(user, 2026-10-31), so
the photo lifecycle of ADR 0009 never removes them while either refers to them. It is offered only to whoever may
request one for the defect now (ST-107's rules: AI on, defect open, technician or suitable for helpers, none being
written). This story asserts the failed one is kept; showing it below the new one is ST-111.

**AI turned off meanwhile** fails an AI assessment still being written with the reason *AI off*; nothing is sent to
OpenRouter then (rule).

**A write that breaks off (HS-33)** – a crash, a deployment, the function's time limit – leaves the AI assessment being
written. The background work holds it for **15 minutes** (ST-112); after that, the **next run** writes it **once
more** – a run started by any request, attached file, continuation or the daily retry, **and by the defect page
itself** when it refreshes and sees one held longer (ADR 0015). The page starts work only when a hold has run out, so
refreshing it never starts paid work twice, and the call uses the server-side secret, never exposed to the browser.
If the second attempt breaks off too, it fails as **"timed out"**. The team member never waits for the next day while
looking at the defect. Only an AI assessment still being written is written or failed – a late result of an earlier
attempt records nothing once one is stored (rule, version check).

**A defect resolved or closed on retirement meanwhile** does not stop the AI assessment – it is written and kept, and
stays with the defect (HS-30).

**A referenced file removed later** stays a reference by its title, without a link (RM-DefectAiAssessments).

**The daily retry** (POL-UnfinishedAiWorkIsRetried, EVT-AiWorkLeftUnfinished – derived, not recorded): once a day at
night (Europe/Berlin) a scheduled job of the hosting starts a run that finds AI assessments still being written whose
hold ran out and files still waiting while AI is on (ADR 0015). Vercel runs it for production only; previews and local
development rely on the other starts, and the scenario drives the run function directly. Failed files are retried by
ST-109 (HS-32).

**Interface:** the failure text in the place of the AI assessment (G35); „Erneut versuchen“ only where the person may
use it (G11).

**Definition of done** (not scenarios):
1. `vercel.json` gets the daily cron job calling the worker route (ADR 0015), checked by the `vercel.json` cron scan
   of ST-112; `docs/operations/` says how to check that it ran.
2. The **first run of the cron on production is checked by hand** after the first production deployment, because
   previews cannot run it; the check is recorded in `docs/operations/`.
3. The pull request goes through the normal review lane plus `/security-review` (a defect page's GET that starts paid
   work); `/code-review` is optional (it extends the shared run code of ST-112).

## Acceptance Criteria

Scenario Outline: A failed AI assessment says why in German and offers „Erneut versuchen“
  Given AI is on and an AI assessment of the open defect "Left flipper weak" is being written
  When the writing ends with <what happens>
  Then the defect page shows „KI-Einschätzung fehlgeschlagen: <reason text>“, the fixed text for <reason>
  And the page shows no text from OpenRouter's answer
  And a technician is offered „Erneut versuchen“

  Examples:
    | what happens                                                       | reason                   | reason text                                                                                              |
    | OpenRouter refusing the key                                         | key invalid              | OpenRouter hat den API-Schlüssel abgelehnt. Techniker:innen können ihn unter Einstellungen ersetzen.     |
    | OpenRouter saying the credit is used up                             | credit used up           | Das Guthaben bei OpenRouter ist aufgebraucht.                                                            |
    | no provider that neither keeps nor trains on the data has the model | model not available      | Das Chat-Modell ist bei OpenRouter gerade nicht ohne Datenspeicherung verfügbar.                         |
    | OpenRouter not answering, because it cannot be reached              | OpenRouter not reachable | OpenRouter war nicht erreichbar.                                                                         |
    | an empty answer of the chat model                                   | answer unusable          | Die Antwort der KI war unbrauchbar.                                                                      |
    | an answer of the chat model that has no usable summary              | answer unusable          | Die Antwort der KI war unbrauchbar.                                                                      |

Scenario: „Erneut versuchen“ asks for a new AI assessment with the same note and photos
  Given the AI assessment of "Left flipper weak" with the note "Coil gets hot" and two photos failed with the reason credit used up
  When a technician taps „Erneut versuchen“
  Then a new AI assessment of "Left flipper weak" is being written, without a request form in between
  And the new AI assessment carries the note "Coil gets hot" and the same two photos
  And the failed AI assessment is kept as it is, its reason unchanged, and "Left flipper weak" has two AI assessments
  And a helper is not offered „Erneut versuchen“ on "Left flipper weak", which is not suitable for helpers

Scenario: AI turned off meanwhile fails the AI assessment without sending anything
  Given an AI assessment of "Left flipper weak" is requested and its writing has not started
  When a technician removes the key before it starts
  Then the AI assessment fails with the reason AI off
  And nothing about "Left flipper weak" is sent to OpenRouter
  And „Erneut versuchen“ is not offered while AI is off

Scenario: A write that breaks off is written once more after 15 minutes
  Given the writing of an AI assessment of "Left flipper weak" broke off 16 minutes ago
  When a team member has the defect page of "Left flipper weak" open and it refreshes itself
  Then the AI assessment is written once more
  And the page shows it once it is written

Scenario: A second break-off fails the AI assessment as timed out
  Given the writing of an AI assessment of "Left flipper weak" broke off and its second attempt broke off too
  When 15 minutes have passed since the second attempt began and the next run starts
  Then the AI assessment fails with the reason timed out
  And a technician may ask for a new AI assessment of "Left flipper weak"

Scenario: A late result does not change a stored AI assessment
  Given the first attempt at an AI assessment of "Left flipper weak" took longer than 15 minutes and a second attempt was started
  When the second attempt stores its AI assessment and the first one finishes afterwards
  Then the AI assessment is the one the second attempt stored
  And its cost and its result are recorded once

Scenario: A defect resolved meanwhile does not stop the AI assessment
  Given an AI assessment of "Left flipper weak" is being written
  When a technician resolves "Left flipper weak" before it is written
  Then the AI assessment is written and kept with "Left flipper weak"
  And "Left flipper weak" stays resolved

Scenario: A referenced file removed later stays a reference without a link
  Given the written AI assessment of "Left flipper weak" refers to "Eight Ball Manual" page 12
  When a technician removes the file "Eight Ball Manual"
  Then the AI assessment still names "Eight Ball Manual" page 12
  And that reference no longer opens a file

Scenario: The daily retry finishes AI work left behind
  Given AI is on, the writing of an AI assessment broke off more than 15 minutes ago, a file is waiting, and no other run starts
  When the daily retry runs at night
  Then the AI assessment is written once more
  And the waiting file is indexed

## Out of Scope
- Failed files and their retry (ST-109)
- Earlier AI assessments collapsed, the failed one shown below a newer one (ST-111)
- Notifying anyone of a failure (`docs/product/vision.md`, non-goal: active notifications)

## Open Questions
- none – „Erneut versuchen“ and the reason texts were answered by the user on 2026-10-31
  (`docs/stories/OPEN_QUESTIONS.md`, ST-108).

## Notes
- OpenRouter is behind the AI seam (ADR 0014); the stand-in gives each kind of answer. A broken-off write and the
  15 minutes are driven with the injected clock and one run of the background work (ST-112's run function, ADR 0015) –
  no test waits.
- If L proves too large in `/implement`: the break-off, the second break-off, the late result and the daily retry
  (scenarios 4–6 and 9) become a story of their own; ST-109 would then depend on it (story review 2026-10-31).
- For the domain-architect: two AI assessments may refer to the same stored photos (ADR 0009 interplay, story review
  2026-10-31, section 5).

---
id: ST-108
title: An AI assessment that fails or breaks off says why and can be tried again
type: story
context: BC-AiAssistance
priority: should
size: M
risk: medium
events: [EVT-AiAssessmentFailed, EVT-AiAssessmentWritten, EVT-AiAssessmentRequested, EVT-AiWorkLeftUnfinished]
depends_on: [ST-107]
labels: [ui, feature:ai-assessment]
status: in-progress
---

## Story
As a team member who asked for an AI assessment, I want to see in plain German why it failed and to try again – and never to find it stuck – so that I know whether to wait, ask again or tell a technician.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **AGG-AiAssessment**, **CMD-WriteAiAssessment**,
**CMD-RequestAiAssessment**, **EVT-AiAssessmentFailed**, **EVT-AiWorkLeftUnfinished**,
**POL-UnfinishedAiWorkFails**, **RM-DefectAiAssessments**, resolved **HS-30**, **HS-33**; ADR 0014; ADR 0015;
`docs/domain/context-map.md`, *OpenRouter → AI assistance*). The special cases of ST-107. Revised after the story review
`docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31) and after decision D3 of
`docs/reviews/2026-11-01-story-review.md` (user, 2026-11-01): no cron job, no automatic retry, no second attempt.

**A failed AI assessment (G35)** shows in the section „KI-Einschätzungen“ as „KI-Einschätzung fehlgeschlagen:
<Grund>“ with **„Erneut versuchen“**. The reason is one fixed German text per kind (EVT-AiAssessmentFailed, data model
`AssessmentFailureReason`; user, 2026-10-31; *broken off* user, 2026-11-01, UI word „abgebrochen“ from `CONTEXT.md`):

| Reason | German text |
|---|---|
| *key invalid* | „OpenRouter hat den API-Schlüssel abgelehnt. Techniker:innen können ihn unter Einstellungen ersetzen.“ |
| *credit used up* | „Das Guthaben bei OpenRouter ist aufgebraucht.“ |
| *model not available* (also: no provider for the chat model that neither keeps nor trains on the data, ADR 0014) | „Das Chat-Modell ist bei OpenRouter gerade nicht ohne Datenspeicherung verfügbar.“ |
| *timed out* – only OpenRouter not answering in time | „Die KI hat nicht rechtzeitig geantwortet.“ |
| *OpenRouter not reachable* | „OpenRouter war nicht erreichbar.“ |
| *AI off* | „Die KI wurde inzwischen ausgeschaltet.“ |
| *answer unusable* | „Die Antwort der KI war unbrauchbar.“ |
| *broken off* – the writing ended without a result | „Die Arbeit daran wurde abgebrochen, bevor sie fertig war.“ |

**Never OpenRouter's own text** – the anti-corruption layer turns every answer into one of these reasons (context map).
A failed AI assessment is a state of the page, not a rejection of a form (G35), and it is kept with the defect like a
written one (`CONTEXT.md`: *AI assessment*; invariant – written or failed exactly once, then never changed). A failed
AI assessment is never written again automatically (D3).

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

**A write that breaks off (HS-33, D3)** – a crash, a deployment, the function's time limit – leaves the AI assessment
being written while the background work's hold on it lasts (ST-112: longer than a run's budget, derived from it, never
renewed). Once the hold has run out without a result (EVT-AiWorkLeftUnfinished – derived, not recorded), the **next
run**, whatever started it, fails the AI assessment with the reason ***broken off*** before it takes new work, sends
nothing to OpenRouter and drops the hold (POL-UnfinishedAiWorkFails; the generic step is ST-112's, this story records
it for AI assessments). It is **not written again** – the team member may ask for a new one at once with „Erneut
versuchen“. **The defect page starts that run itself**: refreshing while an AI assessment is being written, it calls
the start function of ST-112 once the hold has run out – never before, so refreshing never starts work on every load –
and the call uses the server-side secret, never exposed to the browser. So the team member looking at the defect never
finds it stuck. Only an AI assessment still being written is written or failed – a late result of a run after the AI
assessment was failed as *broken off* records nothing (rule, version check).

**A defect resolved or closed on retirement meanwhile** does not stop the AI assessment – it is written and kept, and
stays with the defect (HS-30).

**A referenced file removed later** stays a reference by its title, without a link (RM-DefectAiAssessments).

**Interface:** the failure text in the place of the AI assessment (G35); „Erneut versuchen“ only where the person may
use it (G11).

**Definition of done** (not scenarios): the pull request goes through the normal review lane plus `/security-review`
(a defect page's GET that starts paid work); `/code-review` is optional (it extends the shared run code of ST-112).

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
    | OpenRouter reachable but not answering in time                      | timed out                | Die KI hat nicht rechtzeitig geantwortet.                                                                |
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

Scenario: A write whose hold ran out without a result fails as broken off and is not written again
  Given AI is on and the run writing an AI assessment of "Left flipper weak" was cut off
  And the hold on that AI assessment has run out without a result, and no other run has started since
  When a team member has the defect page of "Left flipper weak" open and it refreshes itself
  Then the page starts a run, which fails the AI assessment with the reason broken off and sends nothing about it to OpenRouter
  And the page shows „KI-Einschätzung fehlgeschlagen: Die Arbeit daran wurde abgebrochen, bevor sie fertig war.“ and offers a technician „Erneut versuchen“
  And no later run writes that AI assessment again
  And a refresh of the page before the hold had run out started no run

Scenario: A late result after a break-off is not stored
  Given the AI assessment of "Left flipper weak" was failed as broken off while the run that took it was still writing it
  When that run finishes its AI assessment afterwards
  Then the AI assessment stays failed with the reason broken off
  And no written AI assessment and no cost is recorded for it

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

## Out of Scope
- Failed and broken-off files and „Erneut versuchen“ on a file (ST-109)
- Any automatic retry or scheduled job – there is none (D3)
- Earlier AI assessments collapsed, the failed one shown below a newer one (ST-111)
- Notifying anyone of a failure (`docs/product/vision.md`, non-goal: active notifications)

## Open Questions
- none – „Erneut versuchen“ and the reason texts were answered by the user on 2026-10-31
  (`docs/stories/OPEN_QUESTIONS.md`, ST-108); *broken off* and its UI word „abgebrochen“ on 2026-11-01 (D3, HS-35).

## Notes
- OpenRouter is behind the AI seam (ADR 0014); the stand-in gives each kind of answer, *timed out* included. A
  cut-off write and its expired hold are driven with the injected clock and one run of the background work (ST-112's
  run function, ADR 0015) – no test waits. The late result is a run whose stand-in answers only after the injected
  clock has moved past the hold and another run has recorded the break-off.
- Size M, risk medium – re-checked after D3: the daily retry, its cron job, the production cron check and the second
  attempt are gone; what remains is the failure texts, „Erneut versuchen“, the broken-off recording with the defect
  page's start, and the version check. Security review stays for the page that starts paid work.
- For the domain-architect: two AI assessments may refer to the same stored photos (ADR 0009 interplay, story review
  2026-10-31, section 5).

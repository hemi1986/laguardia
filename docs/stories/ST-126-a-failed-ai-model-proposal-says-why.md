---
id: ST-126
title: An AI model proposal that fails or breaks off says why
type: domain
context: BC-AiAssistance
aggregate: AGG-AiModelProposal
command: CMD-WriteAiModelProposal
ui: true
priority: should
size: M
risk: medium
events: [EVT-AiModelProposalWritten, EVT-AiModelProposalFailed]
depends_on: [ST-124]
labels: [feature:ai-model-proposal]
status: ready
---

## Story
As a technician who requested an AI model proposal, I want to see in plain German why it failed and to try again – and never to find it stuck – so that I know whether to wait, change the description or tell the one who looks after the AI settings.

## Context
Feature `ai-model-proposal` (user, 2026-11-07, grilling Q12; `docs/domain/events.yaml` **CMD-WriteAiModelProposal**,
**EVT-AiModelProposalFailed**, **EVT-AiWorkLeftUnfinished**, **POL-UnfinishedAiWorkFails**, **RM-AiModelProposal**,
resolved **HS-33**, open **HS-42**; ADR 0015; `docs/domain/context-map.md`, *OpenRouter → AI assistance*). The special
cases of ST-124; the same pattern as ST-108.

**The proposal page, failed** (G7: say what to do): the reason in plain German, the typed description, and the buttons
„Nochmal versuchen“ and „Verwerfen“ (ST-127). „Nochmal versuchen“ opens the page „Mit KI erstellen“ with the description
already typed in (G8a, HS-42 – resolved, user 2026-11-07); the failed proposal stays until it is
discarded. A failed proposal is never written again automatically; there is no automatic retry (D3 of
`docs/reviews/2026-11-01-story-review.md`).

**Reasons and their text** (EVT-AiModelProposalFailed): „Das Gerät wurde nicht erkannt.“ (device not recognised),
„Die Antwort der KI war nicht brauchbar.“ (answer unusable), „Die KI ist ausgeschaltet.“ (AI off, nothing is sent to
OpenRouter then), „Abgebrochen“ (broken off – a crash, a deployment or the time limit; recorded by the next run once
the hold has run out, ADR 0015), and the reasons of the AI assessment (key invalid, credit used up, model not available,
timed out, OpenRouter not reachable) with the same texts as ST-108. No web tools or no documents is no failure
(ST-124).

**Other rules:** a late result of a run after the proposal was failed as broken off records nothing (version check).
AI turned off while a proposal is written fails the running one; a written one stays readable and can be saved
(ST-128 needs no AI).

## Acceptance Criteria

Scenario: A device that is not recognised
  Given a requested AI model proposal for "asdf"
  When the AI model proposal is written and the AI found no machine
  Then the proposal is failed with the reason that the device was not recognised
  And the proposal page shows the reason and the description "asdf"

Scenario: Try again keeps the description
  Given a failed AI model proposal for "Flipper High Speed Williams"
  When the technician taps „Nochmal versuchen“
  Then the page „Mit KI erstellen“ opens with "Flipper High Speed Williams" already typed in

Scenario: A write that breaks off
  Given an AI model proposal being written whose hold has run out without a result
  When the next run of the background work starts
  Then the AI model proposal is failed with the reason „Abgebrochen“
  And a late result of the earlier run records nothing

Scenario: AI is turned off while a proposal is written
  Given an AI model proposal being written
  When the AI is turned off before the writing starts
  Then the AI model proposal is failed with the reason „Die KI ist ausgeschaltet.“
  And nothing was sent to OpenRouter

## Out of Scope
- Discarding (ST-127)
- Failures of a single document after saving (ST-129)

## Open Questions
- none

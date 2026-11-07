---
id: ST-127
title: Discard an AI model proposal
type: domain
context: BC-AiAssistance
aggregate: AGG-AiModelProposal
command: CMD-DiscardAiModelProposal
ui: true
priority: should
size: S
risk: low
events: [EVT-AiModelProposalDiscarded]
depends_on: [ST-124]
labels: [feature:ai-model-proposal]
status: in-progress
---

## Story
As a technician, I want to discard an AI model proposal I do not want, so that it no longer clutters the list of open proposals.

## Context
Feature `ai-model-proposal` (user, 2026-11-07, grilling Q8; `docs/domain/events.yaml` **CMD-DiscardAiModelProposal**,
**EVT-AiModelProposalDiscarded**, **RM-AiModelProposals**). „Verwerfen“ on the proposal page of a written or failed
proposal, for every technician (the two of them share the list, Q8). Nothing is saved, no file is touched. After
discarding the technician lands on the machine models page and the proposal is gone from „KI-Vorschläge“ (G3); a
confirmation says „KI-Vorschlag verworfen.“ A proposal being written, accepted or already discarded does not offer „Verwerfen“ – the button is not there (G11) –
and the command refuses it anyway. With no open proposal the section „KI-Vorschläge“ is not shown at all, so there is
no empty state to design (G7). Discarding works while AI is off.

## Acceptance Criteria

Scenario: A written AI model proposal is discarded
  Given a written AI model proposal "High Speed"
  When a technician discards it
  Then it is no longer listed under „KI-Vorschläge“
  And no machine model "High Speed" was created

Scenario: A failed AI model proposal is discarded
  Given a failed AI model proposal
  When a technician discards it
  Then it is no longer listed under „KI-Vorschläge“

Scenario: An AI model proposal that was saved meanwhile cannot be discarded
  Given a written AI model proposal that the other technician saved a moment ago
  When a technician discards it
  Then the discarding is rejected with the reason that it was already saved
  And the page shows the machine model that was created

## Out of Scope
- Saving (ST-128)

## Open Questions
- none

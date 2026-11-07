---
id: ST-130
title: Retry a proposed document that failed to load
type: domain
context: BC-AiAssistance
aggregate: AGG-AiModelProposal
command: CMD-RetryProposedDocument
ui: true
priority: should
size: S
risk: low
events: [EVT-ProposedDocumentLoadingRetried]
depends_on: [ST-129]
labels: [feature:ai-model-proposal]
status: ready
---

## Story
As a technician, I want to retry a link that failed to load, so that a short outage of the other site does not cost me the document.

## Context
Feature `ai-model-proposal` (user, 2026-11-07, grilling Q10 (b), Q12; `docs/domain/events.yaml`
**CMD-RetryProposedDocument**, **EVT-ProposedDocumentLoadingRetried**, **POL-AcceptedProposalDocumentsAreLoaded**;
ADR 0019). „Nochmal versuchen“ beside a failed link on the proposal page of a saved proposal: the link is waiting again
(„wird geladen …“) and loaded as in ST-129 (G35). Only a failed link; for a loaded or waiting link „Nochmal versuchen“ is not offered (G11) and the
command refuses it anyway. Works while AI is off. A link that failed for a reason that cannot change – too large,
no PDF or text – may be retried as well; the same reason follows, which is the honest result.

## Acceptance Criteria

Scenario: A failed link is retried and loaded
  Given a saved AI model proposal whose link "High Speed Manual" failed as „nicht erreichbar“
  When the technician taps „Nochmal versuchen“ and the site answers now
  Then the file "High Speed Manual" exists, attached to the machine model, and the link is loaded

Scenario: A link that is not failed cannot be retried
  Given a saved AI model proposal whose link "High Speed Manual" is already loaded
  When a technician retries it
  Then the retry is rejected with the reason that the link did not fail
  And no second file was added

## Out of Scope
- Retrying the whole AI model proposal (ST-126)

## Open Questions
- none

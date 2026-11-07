---
id: ST-123
title: Request an AI model proposal from a description
type: domain
context: BC-AiAssistance
aggregate: AGG-AiModelProposal
command: CMD-RequestAiModelProposal
ui: true
priority: must
size: M
risk: medium
events: [EVT-AiModelProposalRequested]
depends_on: [ST-122, ST-006, ST-104]
labels: [feature:ai-model-proposal]
status: done
---

## Story
As a technician, I want to type which device I want to add – for example "Flipper High Speed Williams" – and have the AI start a proposal, so that I do not fill in every field of the machine model by hand.

## Context
Feature `ai-model-proposal` (user, 2026-11-07; `docs/domain/events.yaml` **AGG-AiModelProposal**,
**CMD-RequestAiModelProposal**, **EVT-AiModelProposalRequested**, **POL-RequestedAiModelProposalIsWritten**,
**RM-AiModelProposals**, **FLOW-AiModelProposal**, resolved **HS-37**; ADR 0015; ADR 0017; ADR 0019). The request only;
the writing is ST-124, failures ST-126.

**On the machine models page** (`/team/machine-models`, technicians, ST-006), above the list: the button
„Mit KI erstellen“ (UX: G2a – creating happens on its own page) and, if there are open proposals, the section
„KI-Vorschläge“ (RM-AiModelProposals): one line per open proposal with its description, its state and a link to its
page. **While AI is off the button is absent, not disabled** (G37); the section is shown only for what is open. The
form below the list stays as it is (ST-006's exception ended with ST-036).

**The page „Mit KI erstellen“** – its own page, back to the machine models page via „Abbrechen“ (G3): one field
„Welches Gerät?“ with an example „Flipper High Speed Williams“ and the button „Vorschlag erstellen“. No other fields –
the AI finds category, year and the rest itself.

**After sending (G35):** the technician lands on the proposal page at once; it says „KI arbeitet …“ and refreshes
itself, also without JavaScript, until the proposal is written or failed (the page itself is ST-124 and ST-126). The
technician may leave; the proposal is found again in „KI-Vorschläge“.

**Rules** (CMD-RequestAiModelProposal): AI is on; the description is required and not blank; no proposal is being
written – rejected until it is written or failed (HS-37, user 2026-11-07). The description is kept as typed, also when
the request is rejected (G8a). Helpers have no access to the page, like to the machine models page.

UI wording (de): „Mit KI erstellen“, „KI-Vorschlag“, „Welches Gerät?“, „Vorschlag erstellen“, „KI-Vorschläge“.
Rejections: „Bitte beschreibe das Gerät.“ / „Es wird gerade schon ein KI-Vorschlag erstellt. Bitte warte, bis er fertig ist.“ /
„Die KI ist ausgeschaltet.“

## Acceptance Criteria

Scenario: A technician requests an AI model proposal
  Given AI is on and no AI model proposal is being written
  When the technician types "Flipper High Speed Williams" on the page „Mit KI erstellen“ and sends it
  Then the technician is on the page of the new AI model proposal, which says it is being created
  And the machine models page lists it under „KI-Vorschläge“ with the description "Flipper High Speed Williams"

Scenario: An empty description is rejected
  Given AI is on
  When the technician sends the page „Mit KI erstellen“ with a blank description
  Then the request is rejected with the reason that the device must be described
  And no AI model proposal is created

Scenario: No second AI model proposal while one is being written
  Given an AI model proposal is being written
  When a technician requests another one
  Then the request is rejected with the reason that one is being created
  And the description the technician typed is still in the field

Scenario: Nobody requests while AI is off
  Given AI is off
  When a technician opens the machine models page
  Then the button „Mit KI erstellen“ is not there
  And a request sent anyway is rejected with the reason that AI is off

## Out of Scope
- Writing the proposal (ST-124, ST-125), its failure (ST-126), discarding (ST-127), saving (ST-128)
- Limiting the cost beyond one proposal at a time

## Open Questions
- none

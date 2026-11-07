---
id: ST-128
title: Save an AI model proposal as a machine model with its files
type: domain
context: BC-AiAssistance
aggregate: AGG-AiModelProposal
command: CMD-AcceptAiModelProposal
ui: true
priority: must
size: L
risk: high
events: [EVT-AiModelProposalAccepted]
depends_on: [ST-124, ST-125, ST-006, ST-113]
labels: [feature:ai-model-proposal]
status: in-progress
---

## Story
As a technician, I want to correct the proposed fields, tick the documents and save, so that the machine model exists with its files without my typing each one.

## Context
Feature `ai-model-proposal` (user, 2026-11-07; `docs/domain/events.yaml` **CMD-AcceptAiModelProposal**,
**EVT-AiModelProposalAccepted**, **EVT-MachineModelCreated**, **CMD-CreateMachineModel**, **CMD-AttachFile**,
**RM-AiModelProposal**, resolved **HS-39**, open **HS-38**; ADR 0019; ADR 0018). „Speichern“ on the written proposal
page: the fields as corrected, the documents as ticked, the file category of each link as chosen.

**In one transaction** (ADR 0019): `CMD-CreateMachineModel` with the fields and, for each ticked existing file,
`CMD-AttachFile` to the new machine model – all or nothing. The ticked links are not touched here; they are loaded
afterwards (ST-129). The proposal keeps what the AI proposed; the fields as saved are the machine model's.

**Rules:** a ticked existing file removed between writing and saving rejects saving and names the document, keeping the form (HS-38, user 2026-11-07); the proposal is written and neither accepted nor discarded; the fields obey the rules of ST-006 (title,
manufacturer and machine category required; technology fits the category; the year, if given, has four digits); a
rejection names the reason and keeps what was typed and ticked (G8a); a machine model with the same title and
manufacturer existing is **no rejection** (HS-39, user 2026-11-07) – the page shows before saving the hint
„Ein Modell mit diesem Titel und Hersteller gibt es schon.“ with a link to it. Saving works while AI is off.

**Afterwards (G3):** the technician lands on the proposal page, now saying „Gespeichert“, naming and linking the
machine model, listing the attached files and, for each ticked link, „wird geladen …“ (the page refreshes itself, G35).
The proposal is open in „KI-Vorschläge“ while a link is waiting or failed.

UI wording (de): „Speichern“, „Gespeichert“, „Wird geladen …“. Rejections: „Bitte gib einen Titel an.“ and the other
reasons of ST-006 as in the catalog; „Dieser KI-Vorschlag wurde schon gespeichert.“

## Acceptance Criteria

Scenario: Saving creates the machine model and attaches the chosen files
  Given a written AI model proposal with the title "High Speed" and the existing file "Pinball wiki – System 11" ticked
  When the technician changes the year from 1986 to 1987 and saves
  Then the machine model "High Speed" with the year 1987 exists
  And the file "Pinball wiki – System 11" is attached to it

Scenario: A rejected form keeps what was typed
  Given a written AI model proposal with an empty manufacturer
  When the technician saves without a manufacturer
  Then saving is rejected with the reason that the manufacturer is required
  And no machine model was created and the fields and ticks are as they were

Scenario: A proposal that was saved already
  Given a written AI model proposal that the other technician saved a moment ago
  When a technician saves it
  Then saving is rejected with the reason that it was already saved
  And only one machine model exists

Scenario: A machine model with the same title and manufacturer exists
  Given the machine model "High Speed" by "Williams" exists
  When the technician opens a written proposal for "High Speed" by "Williams"
  Then the page shows the hint with a link to the existing machine model
  And saving is still possible

## Out of Scope
- Loading the links (ST-129) and retrying one (ST-130)
- Correcting a machine model later (ST-036)

## Open Questions
- none

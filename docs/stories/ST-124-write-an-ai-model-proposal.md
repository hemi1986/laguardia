---
id: ST-124
title: The AI completes the machine model and finds documents on the web
type: domain
context: BC-AiAssistance
aggregate: AGG-AiModelProposal
command: CMD-WriteAiModelProposal
ui: true
priority: must
size: L
risk: high
events: [EVT-AiModelProposalWritten, EVT-AiModelProposalFailed]
depends_on: [ST-123, ST-122]
labels: [feature:ai-model-proposal]
status: review
---

## Story
As a technician who requested an AI model proposal, I want to see the machine model's fields filled in and documents found on the web, so that I only have to check them.

## Context
Feature `ai-model-proposal` (user, 2026-11-07; `docs/domain/events.yaml` **CMD-WriteAiModelProposal**,
**EVT-AiModelProposalWritten**, **POL-RequestedAiModelProposalIsWritten**, **RM-AiModelProposal**, **EXT-OpenRouter**,
resolved **HS-40**, open **HS-41** (spike ST-122); ADR 0014; ADR 0015; ADR 0019). The happy path from the web; existing
files of the museum are ST-125, failures and break-offs ST-126, saving ST-128.

**The writing** (background, started after ST-123's response): the chat model of the settings gets the description and
OpenRouter's server tools for web search and fetching a page; it completes title, manufacturer, year, machine category
and technology and names documents: an official manual, schematics, entries of the Pinball wiki and other text
documents about the machine or its system (user, 2026-11-07). No images, no video. The answer carries the sources it
relied on for the fields.

**The proposal page, written** (RM-AiModelProposal; G2a's form logic, G3, G7): the fields as a form already filled in
(title, manufacturer, year, machine category, technology) and, for a field the AI could not fill, an empty field with
the text „Nicht gefunden“ beside it; below, „Quellen“ – the links the fields rest on; below, the group „Aus dem Netz
laden“ with the documents (title, file category as a choice of Handbuch / Schaltplan / Sonstiges, the link as its
source, a tick, set by default) and the buttons „Speichern“ and „Verwerfen“ (ST-127, ST-128).

**Rules:** a value that is not valid – a machine category of none of the three, a technology that does not fit it, a
year that is not four digits – is left empty, not repaired; at most 10 documents; only `https` links; when search or
fetching is not available or finds nothing, the proposal is written without documents and says „Keine Dokumente
gefunden.“ (no failure, user 2026-11-07). Nothing is loaded yet – the links are only proposals (HS-40).

## Acceptance Criteria

Scenario: Fields and documents from the web are proposed
  Given a requested AI model proposal for "Flipper High Speed Williams"
  When the AI model proposal is written and the AI named the title "High Speed", the manufacturer "Williams", the year 1986, the machine category Pinball, the technology Solid-state and a manual with an https link
  Then the proposal page shows these fields filled in and the sources
  And the manual is listed under „Aus dem Netz laden“ with the file category Handbuch, ticked

Scenario: A value that is not valid is left empty
  Given a requested AI model proposal
  When the AI model proposal is written and the AI named the year "ca. 1986" and the technology CRT for the machine category Pinball
  Then the year and the technology are empty and say „Nicht gefunden“
  And the other fields are filled in

Scenario: No documents found
  Given a requested AI model proposal
  When the AI model proposal is written and the web search found nothing
  Then the proposal page says „Keine Dokumente gefunden.“
  And the fields are still filled in

Scenario: At most ten documents
  Given a requested AI model proposal
  When the AI model proposal is written and the AI named twelve documents
  Then the proposal page lists ten documents

## Out of Scope
- Files already in the museum (ST-125)
- Failures, a write that breaks off, AI turned off meanwhile (ST-126)
- Loading the links (ST-129)

## Open Questions
- [OPEN] HS-41: whether the server tools work with the chosen chat model together with a structured answer – answered by ST-122 before this story is `ready`.

---
id: ST-125
title: The proposal offers files the museum already has
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
As a technician, I want the proposal to offer files the museum already has for this device or its system, so that a Pinball wiki entry about System 11 is attached instead of loaded and stored a second time.

## Context
Feature `ai-model-proposal` (user, 2026-11-07, grilling Q6; `docs/domain/events.yaml` **CMD-WriteAiModelProposal**,
**EVT-AiModelProposalWritten**, **RM-AiModelProposal**; ADR 0014; ADR 0018; `docs/domain/context-map.md`,
*Collection → AI assistance*). The second part of ST-124's command: after the fields are completed, the AI index is
searched with them (title, manufacturer, year, technology) among **all** files, also those attached to nothing (ADR 0018);
the hits are files, not pages – a file counts once.

**The proposal page** adds the group „Schon im Museum vorhanden“ **above** „Aus dem Netz laden“: each file with its
title, its file category (shown only – the category belongs to the file), a tick (set by default) and a link to its file
details. When saved (ST-128), a ticked file is **attached** to the new
machine model – no copy. The group is not shown when nothing was found.

**Rules:** the existing files count within the 10 documents, first; only files that are not removed and have an AI index
entry for the current embedding model are found; the number of hits is fixed, not a setting.

UI wording (de): „Schon im Museum vorhanden“, „Aus dem Netz laden“.

## Acceptance Criteria

Scenario: A file the museum already has is offered
  Given the museum has the Markdown file "Pinball wiki – System 11" attached to the machine model "Funhouse"
  When the AI model proposal for "Flipper High Speed Williams" is written and the AI index finds it
  Then the proposal page shows it under „Schon im Museum vorhanden“, ticked, with a link to its file details

Scenario: A file attached to nothing is found too
  Given the museum has the manual "High Speed Operations Manual" attached to nothing
  When the AI model proposal for "Flipper High Speed Williams" is written and the AI index finds it
  Then the proposal page offers it under „Schon im Museum vorhanden“

Scenario: Nothing found in the museum
  Given the AI index finds no file for the device
  When the AI model proposal is written
  Then the proposal page shows no group „Schon im Museum vorhanden“

## Out of Scope
- Changing a file's title or category (file details, ST-116)
- Attaching on saving (ST-128)

## Open Questions
- none

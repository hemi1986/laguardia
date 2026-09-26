---
id: ST-038
title: Remove a file
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-FileRemoved]
depends_on: [ST-037]
labels: [files]
status: review
---

## Story
As a technician, I want to remove a wrong or outdated file, so that the team only finds correct manuals and schematics at the machine.

## Context
Command `CMD-RemoveFile` (technicians only – `docs/product/vision.md`: file deletion is technician-only). Invariant: a removed file stays removed. The content of a removed file is deleted from object storage; the record of which file was removed, by whom and when is kept (`docs/architecture/data-model.md`).

## Acceptance Criteria

Scenario: Technician removes a file
  Given the machine model "Medieval Madness" has the file "MM Manual (wrong edition)"
  When a technician removes it
  Then no machine record shows "MM Manual (wrong edition)" anymore
  And its content is deleted from object storage
  And it is recorded which file was removed, by whom and when

Scenario: Helpers cannot remove files
  Given a helper is logged in
  When the helper tries to remove a file
  Then the action is rejected
  And the file is still shown

Scenario: A removed file stays removed
  Given the file "MM Manual (wrong edition)" was removed
  When anyone tries to open it via its former address
  Then it cannot be opened

## Out of Scope
- Replacing a file with a new version (attach the new file, remove the old one)

## Open Questions
- none

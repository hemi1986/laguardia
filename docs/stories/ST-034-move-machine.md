---
id: ST-034
title: Move a machine to a new location
type: story
context: BC-Collection
priority: should
size: XS
risk: low
events: [EVT-MachineMoved]
depends_on: [ST-009]
labels: [mvp, collection, ui]
status: in-progress
---

## Story
As a team member, I want to update a machine's location when it is moved, so that everyone finds the machine where La Guardia says it stands.

## Context
Command `CMD-MoveMachine` (any team member – the location is informational, HS-18). Rules:
- The machine is not retired.
- The location is free text (e.g. "Hall 2, row 3") and required (`docs/architecture/data-model.md`).
- The location changes: saving the location the machine already has is rejected, as with the machine status – no change without a change (user, test plan of 2026-10-18).
- A retired machine cannot be moved (`AGG-Machine`; this scenario belongs here, not in ST-039 – wanted in the backlog grooming of 2026-10-11, applied 2026-10-17).
UI wording (de): Standort.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G3, G8): the machine record (owner ST-009, G18) offers „Standort ändern“ in its section 3, next to the location, which leads to the page „Standort von LG-042 ändern“ with the current location filled in. After the change the team member lands on the machine record with the confirmation „LG-042 steht jetzt in „Workshop“.“ A rejection stays on the form and keeps the typed text.

## Acceptance Criteria

Scenario: Helper moves a machine
  Given the machine "LG-042" stands at "Hall 2, row 3"
  When the helper Anna changes its location to "Workshop"
  Then "LG-042" stands at "Workshop"
  And the machine overview and the machine record show "Workshop" for "LG-042"
  And the confirmation names "LG-042" and its new location "Workshop"

Scenario: Location is required
  When a team member changes the location of "LG-042" to an empty text
  Then the change is rejected
  And "LG-042" keeps its location

Scenario: Retired machines cannot be moved
  Given the machine "LG-013" is retired
  When a team member tries to change its location
  Then the change is rejected

## Out of Scope
- Changing the machine status when a machine goes to the workshop (ST-012)

## Open Questions
- none

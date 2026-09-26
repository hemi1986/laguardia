---
id: ST-034
title: Move a machine to a new location
type: story
context: BC-Collection
priority: must
size: XS
risk: low
events: [EVT-MachineMoved]
depends_on: [ST-009]
labels: [mvp, collection]
status: ready
---

## Story
As a team member, I want to update a machine's location when it is moved, so that everyone finds the machine where La Guardia says it stands.

## Context
Command `CMD-MoveMachine` (any team member – the location is informational, HS-18). Rules:
- The machine is not retired.
- The location is free text (e.g. "Hall 2, row 3") and required (`docs/architecture/data-model.md`).
UI wording (de): Standort.

## Acceptance Criteria

Scenario: Helper moves a machine
  Given the machine "LG-042" stands at "Hall 2, row 3"
  When the helper Anna changes its location to "Workshop"
  Then "LG-042" stands at "Workshop"
  And the machine overview and the machine record show "Workshop" for "LG-042"

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

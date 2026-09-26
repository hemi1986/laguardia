---
id: ST-055
title: Retired machines in the overview, search and visitor page
type: story
context: BC-Collection
priority: must
size: S
risk: low
events: [EVT-MachineRetired]
depends_on: [ST-039]
labels: [mvp, collection]
status: ready
---

## Story
As a team member, I want retired machines to leave the active lists but still be findable, and visitors scanning an old sticker to get a clear note, so that the active views stay clean while the history stays reachable.

## Context
Second part of the split of ST-039 (story review 2026-09-26).
- A retired machine is not listed in the machine overview (ST-008) by default; the filter "show retired machines" lists them, marked as retired.
- Searching by museum number also finds retired machines, marked as retired.
- Its visitor machine page only says in the visitor's language that the machine is no longer in the museum – no machine status, no defects, no reporting.
- Its machine record stays reachable, marked as retired (ST-009).

## Acceptance Criteria

Scenario: Retired machines leave the machine overview
  Given "LG-013" is retired
  When a team member opens the machine overview
  Then "LG-013" is not listed

Scenario: Team members find retired machines with a filter
  Given "LG-013" is retired
  When a team member turns on the filter "show retired machines" in the machine overview
  Then "LG-013" is listed and marked as retired

Scenario: Search by museum number finds retired machines
  Given "LG-013" is retired
  When a team member searches the machine overview for "013"
  Then "LG-013" is found and marked as retired

Scenario: Visitor machine page of a retired machine
  Given "LG-013" is retired
  When a visitor opens the visitor machine page of "LG-013", e.g. via its old QR sticker
  Then the page says in the visitor's language that the machine is no longer in the museum
  And it shows neither machine status nor defects
  And reporting a problem is not offered

## Out of Scope
- Retiring itself (ST-039)

## Open Questions
- none

---
id: ST-055
title: Retired machines in the overview, search and visitor page
type: story
context: BC-Collection
priority: could
size: S
risk: low
events: [EVT-MachineRetired]
depends_on: [ST-039]
labels: [mvp, collection, ui]
status: in-progress
---

## Story
As a team member, I want retired machines to leave the active lists but still be findable, and visitors scanning an old sticker to get a clear note, so that the active views stay clean while the history stays reachable.

## Context
Second part of the split of ST-039 (story review 2026-09-26).
- A retired machine is not listed in the machine overview (ST-008) by default; the filter "show retired machines" lists them, marked as retired.
- Searching by museum number also finds retired machines, marked as retired.
- Its visitor machine page only says in the visitor's language that the machine is no longer in the museum – no machine status, no defects, no reporting.
- Its machine record stays reachable, marked as retired (ST-009), with „Ausgemustert“ in place of the machine status (ST-039).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G6, G7, G10a):
- The filter in the machine overview's filter form is the checkbox „Auch ausgemusterte Geräte anzeigen“, off by default; turning it on adds the retired machines to the active ones.
- A retired machine carries the marker „Ausgemustert“ in the overview and in search results (G6).
- With the filter on and no retired machine, the overview says „Kein Gerät ist ausgemustert.“ below the active machines.
- The visitor machine page of a retired machine says „Dieses Gerät ist nicht mehr im Museum.“ resp. "This machine is no longer in the museum."

## Acceptance Criteria

Scenario: Retired machines leave the machine overview
  Given "LG-013" is retired
  When a team member opens the machine overview
  Then "LG-013" is not listed

Scenario: Team members find retired machines with a filter
  Given "LG-013" is retired
  When a team member turns on the filter "show retired machines" in the machine overview
  Then "LG-013" is listed and marked as retired

Scenario: The filter says when no machine is retired
  Given no machine is retired
  When a team member turns on the filter "show retired machines" in the machine overview
  Then the active machines are still listed
  And the overview says that no machine is retired

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

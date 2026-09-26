---
id: ST-036
title: Correct a machine model
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-MachineModelCorrected]
depends_on: [ST-009]
labels: [collection]
status: review
---

## Story
As a technician, I want to correct a machine model's title, manufacturer, year, machine category or technology, so that typos and wrong data are fixed for all machines of that model at once.

## Context
Command `CMD-CorrectMachineModel` (technicians only, HS-18). Rules and invariants (`AGG-MachineModel`):
- Title, manufacturer and machine category stay required.
- The technology fits the machine category.
Machine category and technology decide which maintenance tasks apply to its machines, so a correction can change what is due (ST-043).

## Acceptance Criteria

Scenario: Technician corrects the year
  Given the machine model "Medieval Madness" has the year 1979 and the machine "LG-042" is of that model
  When a technician corrects the year to 1997
  Then the machine record and the visitor machine page of "LG-042" show 1997

Scenario: Technology must fit the machine category
  Given the machine model "Galaxian" has the machine category Arcade
  When a technician corrects its technology to EM
  Then the correction is rejected

Scenario: Required details stay required
  When a technician corrects a machine model's title to an empty title
  Then the correction is rejected

Scenario: Helpers cannot correct machine models
  Given a helper is logged in
  When the helper tries to correct a machine model
  Then the correction is rejected

## Out of Scope
- Moving a machine to another machine model

## Open Questions
- none

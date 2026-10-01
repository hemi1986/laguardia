---
id: ST-036
title: Correct a machine model
type: story
context: BC-Collection
priority: must
size: S
risk: low
events: [EVT-MachineModelCorrected]
depends_on: [ST-009, ST-010, ST-043, ST-044]
labels: [mvp, collection, ui]
status: ready
---

## Story
As a technician, I want to correct a machine model's title, manufacturer, year, machine category or technology, so that typos and wrong data are fixed for all machines of that model at once.

## Context
Command `CMD-CorrectMachineModel` (technicians only, HS-18). Rules and invariants (`AGG-MachineModel`):
- Title, manufacturer and machine category stay required.
- The technology fits the machine category.
Machine category and technology decide which maintenance tasks apply to its machines, so a correction can change what is due (ST-043):
- A maintenance task that newly applies because of the correction counts as last done on the correction date (HS-20 resolution, decision D5), so it does not become due immediately.
- A maintenance task that no longer applies disappears from the due maintenance list for these machines; its maintenance records are kept.

## Acceptance Criteria

Scenario: Technician corrects the year
  Given the machine model "Medieval Madness" has the year 1979 and the machine "LG-042" is of that model
  When a technician corrects the year to 1997
  Then the machine record and the visitor machine page of "LG-042" show 1997

Scenario: Correcting the technology changes the applicable maintenance tasks
  Given the machine "LG-005" is of the machine model "Fireball", recorded as Pinball / Solid-state
  And the maintenance task "Clean & adjust score reels / stepper units" is restricted to Pinball / EM
  And "Check fuses, connectors, boards for burn marks" has maintenance records on "LG-005"
  When a technician corrects the technology of "Fireball" to EM on 1 June 2026
  Then "Clean & adjust score reels / stepper units" applies to "LG-005" with last done 1 June 2026
  And the maintenance records of "LG-005" are all kept

Scenario: A task that no longer applies leaves the due list
  Given the maintenance task "Check monitor geometry, convergence, capacitors" is restricted to Arcade / CRT and due on "LG-020"
  When a technician corrects the technology of the machine model of "LG-020" to LCD
  Then "LG-020" is no longer listed as due for that maintenance task
  And its earlier maintenance records for that task are kept

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

---
id: ST-036
title: Correct a machine model
type: story
context: BC-Collection
priority: should
size: M
risk: medium
events: [EVT-MachineModelCorrected]
depends_on: [ST-009, ST-010, ST-043, ST-044]
labels: [mvp, collection, ui]
status: done
---

## Story
As a technician, I want to correct a machine model's title, manufacturer, year, machine category or technology, so that typos and wrong data are fixed for all machines of that model at once.

## Context
Command `CMD-CorrectMachineModel` (technicians only, HS-18). Rules and invariants (`AGG-MachineModel`):
- Title, manufacturer and machine category stay required.
- The technology fits the machine category.
- A machine model has either no year or a four-digit calendar year.
Machine category and technology decide which maintenance tasks apply to its machines, so a correction can change what is due (ST-043):
- A maintenance task that newly applies because of the correction counts as last done on the correction date (HS-20 resolution, decision D5), so it does not become due immediately.
- A maintenance task that no longer applies disappears from the due maintenance list for these machines; its maintenance records are kept.

What Collection publishes for Maintenance (lead dev, backlog grooming 2026-10-17): to know since when a maintenance task applies to a machine, Maintenance needs each machine model's machine category and technology **with the date from which they hold** – the values given at creation, and for every correction that changes the machine category or the technology the correction date with the new values. A correction of title, manufacturer or year changes nothing for Maintenance.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G2a, G3):
- This story ends the known G2a exception of `/team/machine-models`: creating a machine model moves to its own page, reached by the button „Neues Modell“ directly under the list's heading; on success the technician lands back on the list with „Modell „Medieval Madness“ angelegt.“ (ST-006's rules and texts otherwise unchanged).
- A machine model gets its own page, reached from its entry in the list; it shows the model's details and offers „Modell korrigieren“ to technicians.
- The correction form says how many machines it affects: „Gilt für alle 3 Geräte dieses Modells.“ After the correction the technician lands on the machine model's page with a confirmation naming the model.

Decisions at the test plan (user, 2026-10-18):
- Collection keeps a **category history** on the machine model (like the machine status history): an entry at creation and at every correction that changes the machine category or the technology; existing machine models get their creation entry from the journal by migration (`docs/architecture/data-model.md`).
- The count includes retired machines – the correction applies to their machine records too. One machine: „Gilt für das eine Gerät dieses Modells.“; none: „Noch kein Gerät hat dieses Modell.“
- A correction that changes nothing is rejected: „Am Modell hat sich nichts geändert. Bitte etwas ändern.“ (as in ST-031).

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

Scenario: A given year must be a four-digit calendar year
  When a technician corrects a machine model's year to "19x7"
  Then the correction is rejected
  And the machine model keeps its year

Scenario: Creating a machine model happens on its own page
  Given a technician is on the list of machine models
  When the technician chooses to create a new machine model and creates "Medieval Madness"
  Then the creation happened on a page of its own, without the list
  And the technician is back on the list of machine models with the confirmation that "Medieval Madness" was created

Scenario: A machine model has its own page
  Given the machine model "Medieval Madness" with three machines
  When a technician opens "Medieval Madness" from the list of machine models
  Then its own page shows its title, manufacturer, year, machine category and technology
  And it offers to correct the machine model

Scenario: The correction form says how many machines it affects
  Given the machine model "Medieval Madness" has three machines
  When a technician opens the correction form of "Medieval Madness"
  Then the form says that the correction applies to all 3 machines of this model

Scenario: Helpers cannot correct machine models
  Given a helper is logged in
  When the helper tries to correct a machine model
  Then the correction is rejected

## Out of Scope
- Moving a machine to another machine model

## Open Questions
- none

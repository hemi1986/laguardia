---
id: ST-041
title: Maintenance plan – change or remove a maintenance task
type: story
context: BC-Maintenance
priority: should
size: null
risk: null
events: [EVT-MaintenancePlanChanged]
depends_on: [ST-043]
labels: [maintenance]
status: review
---

## Story
As a technician, I want to change a maintenance task's instruction, interval, suitable-for-helpers mark or restriction, or remove it, so that the maintenance plan stays realistic as we learn what the machines need.

## Context
Command `CMD-ChangeMaintenancePlan` (technicians only). Rules and invariants (`AGG-MaintenancePlan`):
- The interval stays a positive time span; a technology restriction fits the restricted machine category.
- A removed maintenance task never becomes due again; its maintenance records are kept.
- Due and overdue are derived when read (`docs/architecture/data-model.md`), so a changed interval applies immediately, counted from the last done date.

## Acceptance Criteria

Scenario: Technician changes the interval
  Given the maintenance task "Clean playfield" has the interval 3 months
  And on "LG-042" it was last done on 1 January 2026
  When a technician changes the interval to 2 months
  Then the due maintenance list shows "Clean playfield" as due on "LG-042" since 1 March 2026

Scenario: Technician changes the suitable-for-helpers mark
  Given the maintenance task "Check fuses, connectors, boards for burn marks" is not suitable for helpers
  When a technician marks it as suitable for helpers
  Then the maintenance plan and the due maintenance list show it as suitable for helpers

Scenario: Technician removes a maintenance task
  Given the maintenance task "Wax playfield" has maintenance records on several machines
  When a technician removes it from the maintenance plan
  Then "Wax playfield" is no longer listed in the maintenance plan
  And it never becomes due again on any machine
  And its maintenance records are kept

Scenario: Invalid change is rejected
  When a technician changes the restriction of a maintenance task to Arcade with the technology EM
  Then the change is rejected
  And the maintenance task keeps its previous restriction

Scenario: Helpers cannot change the maintenance plan
  Given a helper is logged in
  When the helper tries to change or remove a maintenance task
  Then the action is rejected

## Out of Scope
- Restoring a removed maintenance task (add it again instead)

## Open Questions
- none

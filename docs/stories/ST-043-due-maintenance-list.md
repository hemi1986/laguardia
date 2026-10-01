---
id: ST-043
title: Due maintenance list grouped by maintenance task
type: story
context: BC-Maintenance
priority: must
size: M
risk: medium
events: [EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue, EVT-MaintenancePlanChanged, EVT-MachineRegistered]
depends_on: [ST-003, ST-007, ST-040]
labels: [mvp, maintenance, ui]
status: ready
---

## Story
As a helper, I want to see which maintenance tasks are due or overdue on which machines, grouped by maintenance task and sorted by location, so that I can go round the museum and do the same maintenance task on all machines that need it.

## Context
Read model `RM-DueMaintenance`, time-based events `EVT-MaintenanceTaskDue` / `EVT-MaintenanceTaskOverdue` computed on read (`docs/adr/0002-modular-monolith-state-based-persistence.md`). Fields: maintenance task, instruction, suitable for helpers, museum number, machine model title, location, last done, due since, overdue.
Rules (`CONTEXT.md` *Due* / *Overdue*, `docs/architecture/data-model.md`, HS-20 resolution as revised on 2026-09-26, decisions D4 and D5):
- A maintenance task applies to a machine that is registered, not retired, and matches the task's restriction (machine category / technology of its machine model).
- *Last done* = the latest maintenance record with outcome *done*; without one, the task's start date – or the machine's registration date if the machine was registered after the start date. For a task that newly applies after a machine model correction, the correction date (ST-036).
- *Due since* = last done + interval (month arithmetic per the time convention, ST-003).
- *Overdue* once the due date plus 25 % of the interval's actual number of days, rounded up to whole days, has passed (ST-003) – e.g. 12 months = 365 days → overdue 92 days after the due date.
- Removed maintenance tasks are never due.
- Within each maintenance task, machines are sorted by location. A filter shows only maintenance tasks suitable for helpers.
- Machines *Not on display* and machines returning to display: ST-056.

## Acceptance Criteria

Scenario: Maintenance task becomes due
  Given the maintenance task "Clean playfield" (3 months, Pinball) has the start date 1 January 2026
  And the pinball machine "LG-042" was registered in 2025 and has no maintenance record for it
  When a team member opens the due maintenance list on 2 April 2026
  Then "Clean playfield" lists "LG-042" with machine model title, location, last done 1 January 2026 and due since 1 April 2026

Scenario: Machine registered after the start date
  Given the maintenance task "Clean playfield" (3 months, Pinball) has the start date 1 January 2026
  And the pinball machine "LG-061" was registered on 15 May 2026
  When a team member opens the due maintenance list on 1 June 2026
  Then "LG-061" is not listed for "Clean playfield"
  And its last done for "Clean playfield" counts as 15 May 2026, so it is due from 15 August 2026

Scenario: Due maintenance tasks are grouped by maintenance task and sorted by location
  Given "Clean glass (inside & out)" is due on "LG-044" at "Hall 2, row 1", "LG-042" at "Hall 1, row 3" and "LG-043" at "Hall 1, row 1"
  When a team member opens the due maintenance list
  Then "Clean glass (inside & out)" is shown once with its instruction and suitable-for-helpers mark
  And its machines are listed in the order "LG-043", "LG-042", "LG-044"

Scenario: Filter suitable for helpers
  Given "Clean glass (inside & out)" (suitable for helpers) and "Check fuses, connectors, boards for burn marks" (not suitable) are both due
  When a team member filters the due maintenance list by suitable for helpers
  Then only "Clean glass (inside & out)" is shown

Scenario: Maintenance task becomes overdue after 25% of the interval
  Given the maintenance task "Wax playfield" (12 months) was last done on "LG-042" on 1 January 2025, so it is due since 1 January 2026
  When a team member opens the due maintenance list on 1 March 2026
  Then "LG-042" is due but not overdue
  But on 3 April 2026 (92 days after the due date) "LG-042" is marked overdue

Scenario: Restriction decides which machines are listed
  Given the maintenance task "Clean & adjust score reels / stepper units" is restricted to Pinball with the technology EM
  And "LG-042" is a DMD pinball machine and "LG-005" an EM pinball machine
  When the task is due
  Then only "LG-005" is listed for it

Scenario: Retired machines and removed maintenance tasks are not listed
  Given the machine "LG-013" is retired and the maintenance task "Wax playfield" was removed
  When a team member opens the due maintenance list
  Then neither "LG-013" nor "Wax playfield" is listed

## Out of Scope
- Machines Not on display and returning to display (ST-056)
- Recording maintenance (ST-044, ST-045)
- Due maintenance on the machine record and dashboards (ST-047, ST-058, ST-049)

## Open Questions
- none

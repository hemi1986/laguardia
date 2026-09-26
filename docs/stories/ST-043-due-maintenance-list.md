---
id: ST-043
title: Due maintenance list grouped by maintenance task
type: story
context: BC-Maintenance
priority: should
size: null
risk: null
events: [EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue, EVT-MaintenancePlanChanged]
depends_on: [ST-012, ST-040]
labels: [mvp, maintenance]
status: review
---

## Story
As a helper, I want to see which maintenance tasks are due or overdue on which machines, grouped by maintenance task, so that I can go round the museum and do the same maintenance task on all machines that need it.

## Context
Read model `RM-DueMaintenance`, time-based events `EVT-MaintenanceTaskDue` / `EVT-MaintenanceTaskOverdue` computed on read (`docs/adr/0002-modular-monolith-state-based-persistence.md`). Fields: maintenance task, instruction, suitable for helpers, museum number, machine model title, location, last done, due since, overdue.
Rules (`CONTEXT.md`, `docs/architecture/data-model.md`):
- A maintenance task applies to a machine that is registered, not retired, and matches the task's restriction (machine category / technology of its machine model).
- *Last done* = latest maintenance record with outcome *done*, otherwise the task's start date. *Due since* = last done + interval.
- *Overdue* once due for more than 25% of the interval.
- Never due while the machine is *Not on display*. A machine returning to display is due immediately; overdue counts from the day it returned (HS-20).
- Removed maintenance tasks are never due.

## Acceptance Criteria

Scenario: Maintenance task becomes due
  Given the maintenance task "Clean playfield" (3 months, Pinball) has the start date 1 January 2026
  And the pinball machine "LG-042" has no maintenance record for it
  When a team member opens the due maintenance list on 2 April 2026
  Then "Clean playfield" lists "LG-042" with machine model title, location, last done 1 January 2026 and due since 1 April 2026

Scenario: Due maintenance tasks are grouped by maintenance task
  Given "Clean glass (inside & out)" is due on "LG-042", "LG-043" and "LG-044"
  When a team member opens the due maintenance list
  Then "Clean glass (inside & out)" is shown once with its instruction and suitable-for-helpers mark, followed by the three machines

Scenario: Maintenance task becomes overdue after 25% of the interval
  Given the maintenance task "Wax playfield" (12 months) is due on "LG-042" since 1 January 2026
  When a team member opens the due maintenance list on 1 March 2026
  Then "LG-042" is due but not overdue
  But on 1 May 2026 "LG-042" is marked overdue

Scenario: Restriction decides which machines are listed
  Given the maintenance task "Clean & adjust score reels / stepper units" is restricted to Pinball with the technology EM
  And "LG-042" is a DMD pinball machine and "LG-005" an EM pinball machine
  When the task is due
  Then only "LG-005" is listed for it

Scenario: Machines not on display are never due
  Given the machine "LG-030" is Not on display
  And "Clean glass (inside & out)" was last done on "LG-030" two years ago
  When a team member opens the due maintenance list
  Then "LG-030" is not listed

Scenario: Machine back on display is due immediately, overdue counted from its return
  Given "LG-030" was Not on display for a year and "Clean glass (inside & out)" (1 month) was last done before that
  When a technician sets "LG-030" to Playable on 1 June 2026
  Then "Clean glass (inside & out)" is due on "LG-030" from 1 June 2026
  And it becomes overdue only after 25% of the interval has passed since 1 June 2026

Scenario: Retired machines and removed maintenance tasks are not listed
  Given the machine "LG-013" is retired and the maintenance task "Wax playfield" was removed
  When a team member opens the due maintenance list
  Then neither "LG-013" nor "Wax playfield" is listed

## Out of Scope
- Recording maintenance (ST-044, ST-045)
- Due maintenance on the machine record and dashboards (ST-047, ST-048, ST-049)

## Open Questions
- none

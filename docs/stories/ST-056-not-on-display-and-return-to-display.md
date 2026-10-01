---
id: ST-056
title: Due maintenance for machines not on display and returning to display
type: story
context: BC-Maintenance
priority: must
size: S
risk: medium
events: [EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue, EVT-MachineStatusChanged]
depends_on: [ST-012, ST-043]
labels: [mvp, maintenance]
status: ready
---

## Story
As a helper, I want machines that are not on display to disappear from the due maintenance list and to come back sensibly when they return to display, so that the list only shows maintenance I can actually do and doesn't flood after a restoration.

## Context
Second part of the split of ST-043 (story review 2026-09-26). Rules (`CONTEXT.md` *Due* / *Overdue*; HS-20 resolution as revised on 2026-09-26, decision D5):
- A maintenance task is never due on a machine while it is *Not on display* (status history, ST-012). Maintenance can still be recorded there and counts (HS-13, ST-044).
- On return to display the normal interval rule applies: if the task's due date (last done + interval) has not been reached at the return, it becomes due on that normal date.
- Only a maintenance task that was already due at the return counts as due since the return date, and overdue is counted from there (return date + 25 % of the interval's actual days, rounded up, ST-003).

## Acceptance Criteria

Scenario: Machines not on display are never due
  Given the machine "LG-030" is Not on display
  And "Clean glass (inside & out)" was last done on "LG-030" two years ago
  When a team member opens the due maintenance list
  Then "LG-030" is not listed

Scenario: Task already due at the return counts from the return date
  Given "LG-030" was Not on display for a year and "Clean glass (inside & out)" (1 month) was last done there on 1 May 2025
  When a technician sets "LG-030" to Playable on 1 June 2026
  Then "Clean glass (inside & out)" is due on "LG-030" since 1 June 2026
  And it becomes overdue only 8 days after 1 June 2026 (25 % of the 1-month interval's days, rounded up)

Scenario: Task not yet due at the return follows the normal rule
  Given "Wax playfield" (12 months) was done on "LG-030" on 1 March 2026 while it was Not on display
  When a technician sets "LG-030" to Playable on 1 June 2026
  Then "Wax playfield" is not due on "LG-030"
  And it becomes due on 1 March 2027

Scenario: Going off display removes a due task from the list
  Given "Clean glass (inside & out)" is due on "LG-042"
  When a technician sets "LG-042" to Not on display
  Then "LG-042" is no longer listed as due

## Out of Scope
- Recording maintenance on a machine not on display (ST-044)

## Open Questions
- none

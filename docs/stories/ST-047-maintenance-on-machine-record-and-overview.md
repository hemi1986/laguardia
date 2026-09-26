---
id: ST-047
title: Maintenance on the machine record
type: story
context: BC-Maintenance
priority: must
size: S
risk: low
events: [EVT-MaintenanceRecorded, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue]
depends_on: [ST-009, ST-044, ST-056]
labels: [mvp, maintenance]
status: ready
---

## Story
As a technician, I want to see a machine's maintenance records and its due and overdue maintenance tasks on its machine record, and record maintenance from there, so that I see at a glance whether the machine is neglected and can act right at the machine.

## Context
Read model `RM-MachineRecord` (maintenance records, due and overdue maintenance tasks). Due and overdue follow the rules of ST-043 and ST-056. Recording follows the rules of ST-044. The number of overdue maintenance tasks in the machine overview follows in ST-057 (second part of the split, story review 2026-09-26).

## Acceptance Criteria

Scenario: Machine record shows maintenance records
  Given "LG-042" has the maintenance records "Clean glass (inside & out)" done by Anna on 10 June 2026 and "Switch test (every switch)" partially done by Ben with a note
  When a team member opens the machine record of "LG-042"
  Then both maintenance records are shown with maintenance task, who, when, outcome and note, newest first

Scenario: Machine record shows due and overdue maintenance tasks
  Given on "LG-042" "Clean playfield" is due and "Wax playfield" is overdue
  When a team member opens the machine record of "LG-042"
  Then "Clean playfield" is shown as due and "Wax playfield" as overdue, each with due since

Scenario: Recording maintenance from the machine record
  Given "Clean playfield" is due on "LG-042"
  When a helper records "Clean playfield" as done from the machine record of "LG-042"
  Then the maintenance record is stored
  And the machine record no longer shows "Clean playfield" as due

Scenario: Machines not on display show nothing due
  Given the machine "LG-030" is Not on display
  When a team member opens the machine record of "LG-030"
  Then no maintenance task is shown as due or overdue
  But its maintenance records are shown

## Out of Scope
- Number of overdue maintenance tasks in the machine overview (ST-057)

## Open Questions
- none

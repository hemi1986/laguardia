---
id: ST-047
title: Maintenance on the machine record and in the machine overview
type: story
context: BC-Maintenance
priority: should
size: null
risk: null
events: [EVT-MaintenanceRecorded, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue]
depends_on: [ST-009, ST-044]
labels: [maintenance]
status: review
---

## Story
As a technician, I want to see a machine's maintenance records and its due and overdue maintenance tasks on its machine record, and the number of overdue maintenance tasks per machine in the machine overview, so that I see at a glance which machines are neglected.

## Context
Read models `RM-MachineRecord` (maintenance records, due and overdue maintenance tasks) and `RM-MachineOverview` (number of overdue maintenance tasks). Due and overdue follow the rules of ST-043.

## Acceptance Criteria

Scenario: Machine record shows maintenance records
  Given "LG-042" has the maintenance records "Clean glass (inside & out)" done by Anna on 10 June 2026 and "Switch test (every switch)" partially done by Ben with a note
  When a team member opens the machine record of "LG-042"
  Then both maintenance records are shown with maintenance task, who, when, outcome and note, newest first

Scenario: Machine record shows due and overdue maintenance tasks
  Given on "LG-042" "Clean playfield" is due and "Wax playfield" is overdue
  When a team member opens the machine record of "LG-042"
  Then "Clean playfield" is shown as due and "Wax playfield" as overdue, each with due since

Scenario: Machine overview shows the number of overdue maintenance tasks
  Given "LG-042" has 2 overdue maintenance tasks and "LG-043" none
  When a team member opens the machine overview
  Then "LG-042" shows 2 overdue maintenance tasks and "LG-043" none

Scenario: Machines not on display show nothing due
  Given the machine "LG-030" is Not on display
  When a team member opens the machine record of "LG-030"
  Then no maintenance task is shown as due or overdue
  But its maintenance records are shown

## Out of Scope
- Recording maintenance from the machine record (possible via ST-044)

## Open Questions
- none

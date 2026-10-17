---
id: ST-047
title: Maintenance on the machine record
type: story
context: BC-Maintenance
priority: should
size: S
risk: low
events: [EVT-MaintenanceRecorded, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue]
depends_on: [ST-009, ST-044, ST-056]
labels: [mvp, maintenance, ui]
status: review
---

## Story
As a technician, I want to see a machine's maintenance records and its due and overdue maintenance tasks on its machine record, and record maintenance from there, so that I see at a glance whether the machine is neglected and can act right at the machine.

## Context
Read model `RM-MachineRecord` (maintenance records, due and overdue maintenance tasks). Due and overdue follow the rules of ST-043 and ST-056. Recording follows the rules of ST-044. The number of overdue maintenance tasks in the machine overview follows in ST-057 (second part of the split, story review 2026-09-26).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G7, G18, G3):
- The content goes into section 5 of the machine record (owner ST-009, G18), headed „Wartung“.
- First the due and overdue maintenance tasks, each with due since and „Wartung erfassen“, which leads to ST-044's form for that task and machine; after recording, the team member lands back on the machine record with ST-044's confirmation.
- Then the latest maintenance records, newest first, with a link to all maintenance records of the machine. [OPEN] How many records count as "the latest", and which page the link to all leads to, is not decided (recommendation: the 5 latest; the link leads to a page „Wartungseinträge · LG-042“ with all of them, newest first).
- Empty texts: „Gerade ist an diesem Gerät keine Wartung fällig.“ (nothing due), „An diesem Gerät wurde noch keine Wartung eingetragen.“ (no maintenance record), and for a machine that is Not on display „Nicht ausgestellt – es wird keine Wartung fällig.“ in place of the due tasks.

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
  And the helper is back on the machine record of "LG-042"
  And the machine record no longer shows "Clean playfield" as due

Scenario: Machines not on display show nothing due
  Given the machine "LG-030" is Not on display
  When a team member opens the machine record of "LG-030"
  Then no maintenance task is shown as due or overdue
  And the maintenance section says that the machine is not on display, so no maintenance becomes due
  But its maintenance records are shown

Scenario: Nothing due and nothing recorded says so
  Given "LG-050" is on display, no maintenance task is due on it and it has no maintenance record
  When a team member opens the machine record of "LG-050"
  Then the maintenance section says that no maintenance is due on this machine right now
  And it says that no maintenance has been recorded on this machine yet

## Out of Scope
- Number of overdue maintenance tasks in the machine overview (ST-057)

## Open Questions
- [OPEN] How many maintenance records the machine record shows as "the latest", and which page the link to all of them leads to (recommendation: the 5 latest; a page „Wartungseinträge · LG-042“ with all of them, newest first) – `docs/stories/OPEN_QUESTIONS.md`.

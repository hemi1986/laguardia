---
id: ST-047
title: Maintenance on the machine record
type: story
context: BC-Maintenance
priority: should
size: M
risk: low
events: [EVT-MaintenanceRecorded, EVT-MaintenanceTaskDue, EVT-MaintenanceTaskOverdue]
depends_on: [ST-009, ST-044, ST-056]
labels: [mvp, maintenance, ui]
status: done
---

## Story
As a team member, I want to see a machine's maintenance records and its due and overdue maintenance tasks on its machine record, and record maintenance from there, so that I see at a glance whether the machine is neglected and can act right at the machine.

## Context
Read model `RM-MachineRecord` (maintenance records, due and overdue maintenance tasks). Due and overdue follow the rules of ST-043 and ST-056. Recording follows the rules of ST-044 – among them: helpers can only record maintenance tasks suitable for helpers (G11: a helper is not offered „Wartung erfassen“ for the others, and the command refuses them anyway). The number of overdue maintenance tasks in the machine overview follows in ST-057 (second part of the split, story review 2026-09-26). Helpers record most maintenance, so the story speaks for every team member (story review 2026-10-17).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; story review 2026-10-17, `docs/reviews/2026-10-17-story-review.md`; G7, G18, G3, G11, G17, G24):
- The content goes into section 5 of the machine record (owner ST-009, G18), headed „Wartung“.
- First the due and overdue maintenance tasks, each with its due date in ST-043's wording („fällig seit 3. Juni 2026“) and an overdue one with the marker „Überfällig“ (G6a), and „Wartung erfassen“, which leads to ST-044's form for that task and machine.
- **Return path:** opened from the machine record, ST-044's form leads back to it – its back link reads „Zurück zum Gerät“, also after a rejection, and after recording the team member lands on the machine record with ST-044's confirmation (G3, G17). Where the form returns to is a fixed choice – the machine record or the due maintenance list – never an address taken from the request (no open redirect). The confirmation on the machine record is derived on the server as in ST-044, not from a query parameter alone.
- Then the latest maintenance records, newest first. The 5 latest are shown; with more, the link „Alle Wartungseinträge (7)“ leads to the page „Wartungseinträge · LG-042“ with all of them, newest first, and the back link „Zurück zum Gerät“ (user, backlog grooming 2026-10-17; G24). Once that page grows, it groups the maintenance records by year with a count each, like the repair history's own page (ST-033, G4a).
- Empty texts: „Gerade ist an diesem Gerät keine Wartung fällig.“ (nothing due), „An diesem Gerät wurde noch keine Wartung eingetragen.“ (no maintenance record), and for a machine that is Not on display „Nicht ausgestellt – es wird keine Wartung fällig.“ in place of the due tasks.

## Acceptance Criteria

Scenario: Machine record shows maintenance records
  Given "LG-042" has the maintenance records "Switch test (every switch)" partially done by Ben on 2 June 2026 with a note and "Clean glass (inside & out)" done by Anna on 10 June 2026
  When a team member opens the machine record of "LG-042"
  Then both maintenance records are shown with maintenance task, who, when, outcome and note
  And "Clean glass (inside & out)" of 10 June 2026 is shown before "Switch test (every switch)" of 2 June 2026

Scenario: Only the 5 latest maintenance records are on the machine record
  Given "LG-042" has 7 maintenance records
  When a team member opens the machine record of "LG-042"
  Then the 5 newest maintenance records are shown, newest first
  And the link „Alle Wartungseinträge (7)“ leads to the page „Wartungseinträge · LG-042“
  And that page shows all 7 maintenance records, newest first, with the back link „Zurück zum Gerät“

Scenario: Machine record shows due and overdue maintenance tasks
  Given on "LG-042" "Clean playfield" is due since 3 June 2026 and "Wax playfield" is overdue
  When a team member opens the machine record of "LG-042"
  Then "Clean playfield" is shown as „fällig seit 3. Juni 2026“
  And "Wax playfield" is shown with its due date and the marker „Überfällig“

Scenario: Recording maintenance from the machine record
  Given "Clean playfield" is due on "LG-042"
  When a helper records "Clean playfield" as done from the machine record of "LG-042"
  Then the maintenance record is stored
  And the helper is back on the machine record of "LG-042" with the confirmation of ST-044
  And the machine record no longer shows "Clean playfield" as due

Scenario: A rejected recording still leads back to the machine record
  Given a team member opened the form for "Clean playfield" from the machine record of "LG-042"
  When they record it with a date more than 7 days in the past
  Then the maintenance record is rejected
  And the outcome and note they typed are still filled in
  And the form still offers „Zurück zum Gerät“, which leads to the machine record of "LG-042"

Scenario: Helpers record only maintenance suitable for helpers from the machine record
  Given on "LG-042" "Clean glass (inside & out)" (suitable for helpers) and "Check fuses, connectors, boards for burn marks" (not suitable for helpers) are due
  When the helper Anna opens the machine record of "LG-042"
  Then both maintenance tasks are shown as due
  But „Wartung erfassen“ is offered only for "Clean glass (inside & out)"

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
- none – the number of latest records and the page behind the link were decided (user, backlog grooming 2026-10-17).

## Notes
- Size M (lead dev, story review 2026-10-17): a new page, a section that reads across modules, and a change to ST-044's form action (where it returns to).

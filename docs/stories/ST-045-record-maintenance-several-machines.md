---
id: ST-045
title: Record a maintenance task for several machines at once
type: story
context: BC-Maintenance
priority: should
size: M
risk: medium
events: [EVT-MaintenanceRecorded]
depends_on: [ST-044]
labels: [mvp, maintenance, ui]
status: ready
---

## Story
As a helper, I want to record one maintenance task for several machines in one action, so that after cleaning the glass on a whole hall I don't have to record every machine separately.

## Context
`CMD-RecordMaintenance` can be recorded for several machines at once – one *Maintenance recorded* per machine (HS-11). All rules of ST-044 apply to each machine, including the date rule (up to 7 days back, never in the future).
- Selection (decision D8): starting from a maintenance task in the due maintenance list, **all machines the maintenance task applies to** can be selected – the due ones are preselected, the others (sorted by location) can be added.
- The outcome, date and note chosen apply to all selected machines; a machine with a different outcome is recorded separately.
- Each machine is recorded in its own transaction: if some of the selected machines fail a rule (e.g. retired meanwhile), the valid machines are still recorded and the rejected ones are named with the reason.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G4a, G3, G23):
- A maintenance task's view of the due maintenance list (ST-043) offers „Für mehrere Geräte erfassen“ to everyone who may record that task (G11).
- It leads to a selection page for that task (G4a): first the due machines, preselected; then „Weitere Geräte“ – the other machines the task applies to, by location. Outcome, date and note as in ST-044's form, once for all.
- Afterwards the team member lands on the due maintenance list with „„Clean glass“ an 3 Geräten eingetragen.“
- Partial success (G23): the confirmation for the recorded machines is followed by one line per machine that was not recorded, naming the machine and the reason.
- Nothing selected is rejected with the existing text of the form, and nothing is recorded.

## Acceptance Criteria

Scenario: Helper records a maintenance task for several machines
  Given "Clean glass (inside & out)" is due on "LG-042", "LG-043" and "LG-044"
  When the helper Anna selects all three machines for that task and records it as done
  Then there are three maintenance records by Anna with outcome done, one per machine
  And none of the three machines is listed as due for "Clean glass (inside & out)" anymore
  And the confirmation says that "Clean glass (inside & out)" was recorded on 3 machines

Scenario: Due machines are preselected, all applicable machines can be selected
  Given "Clean glass (inside & out)" applies to all pinball machines and is due on "LG-042" but not on "LG-045"
  When a team member starts recording "Clean glass (inside & out)" for several machines
  Then "LG-042" is preselected
  And "LG-045" can be selected as well
  But arcade machines are not offered

Scenario: Machines that are not due can be included
  Given "Clean glass (inside & out)" is due on "LG-042" but not on "LG-045"
  When a team member records it as done for "LG-042" and "LG-045" in one action
  Then both machines get a maintenance record and their interval counts from the recorded date

Scenario: A machine that fails a rule does not stop the others
  Given "LG-044" was retired a moment ago by a technician
  When the helper Anna records "Clean glass (inside & out)" for "LG-042", "LG-043" and "LG-044" in one action
  Then maintenance records are stored for "LG-042" and "LG-043"
  And the confirmation says that the task was recorded on 2 machines
  And a line below it says that "LG-044" was not recorded because it is retired

Scenario: Nothing selected is rejected
  When a team member records "Clean glass (inside & out)" for several machines without selecting any machine
  Then no maintenance record is stored
  And the rejection says to select at least one machine

Scenario: Helpers cannot record several machines for a task not suitable for helpers
  Given "Check PSU voltages, connectors, board" is not suitable for helpers
  When the helper Anna tries to record it for several machines
  Then no maintenance record is stored

## Out of Scope
- Different outcomes or notes per machine in one action

## Open Questions
- none

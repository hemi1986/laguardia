---
id: ST-045
title: Record a maintenance task for several machines at once
type: story
context: BC-Maintenance
priority: should
size: null
risk: null
events: [EVT-MaintenanceRecorded]
depends_on: [ST-044]
labels: [mvp, maintenance]
status: review
---

## Story
As a helper, I want to record one maintenance task for several machines in one action, so that after cleaning the glass on a whole hall I don't have to record every machine separately.

## Context
`CMD-RecordMaintenance` can be recorded for several machines at once – one *Maintenance recorded* per machine (HS-11). All rules of ST-044 apply to each machine. The due maintenance list is grouped by maintenance task for this purpose (`RM-DueMaintenance`).
The outcome and note chosen apply to all selected machines; a machine with a different outcome is recorded separately.
If some of the selected machines fail a rule (e.g. retired meanwhile), the valid machines are still recorded and the rejected ones are named with the reason.

## Acceptance Criteria

Scenario: Helper records a maintenance task for several machines
  Given "Clean glass (inside & out)" is due on "LG-042", "LG-043" and "LG-044"
  When the helper Anna selects all three machines in the due maintenance list and records the task as done
  Then there are three maintenance records by Anna with outcome done, one per machine
  And none of the three machines is listed as due for "Clean glass (inside & out)" anymore

Scenario: Machines that are not due can be included
  Given "Clean glass (inside & out)" is due on "LG-042" but not on "LG-045"
  When a team member records it as done for "LG-042" and "LG-045" in one action
  Then both machines get a maintenance record and their interval counts from today

Scenario: A machine that fails a rule does not stop the others
  Given "LG-044" was retired a moment ago by a technician
  When the helper Anna records "Clean glass (inside & out)" for "LG-042", "LG-043" and "LG-044" in one action
  Then maintenance records are stored for "LG-042" and "LG-043"
  And Anna is told that "LG-044" was not recorded and why

Scenario: Helpers cannot record several machines for a task not suitable for helpers
  Given "Check PSU voltages, connectors, board" is not suitable for helpers
  When the helper Anna tries to record it for several machines
  Then no maintenance record is stored

## Out of Scope
- Different outcomes or notes per machine in one action

## Open Questions
- none

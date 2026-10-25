---
id: ST-057
title: Number of overdue maintenance tasks in the machine overview
type: story
context: BC-Maintenance
priority: could
size: XS
risk: low
events: [EVT-MaintenanceTaskOverdue, EVT-MaintenanceRecorded]
depends_on: [ST-008, ST-043]
labels: [maintenance, ui]
status: in-progress
---

## Story
As a technician, I want the machine overview to show the number of overdue maintenance tasks per machine, so that I spot neglected machines without opening every machine record.

## Context
Second part of the split of ST-047 (story review 2026-09-26). Read model `RM-MachineOverview` field "Number of overdue maintenance tasks". Overdue follows the rules of ST-043 and ST-056.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G6, G13): a machine's entry says the count in words – „1 Wartungsaufgabe überfällig“ / „2 Wartungsaufgaben überfällig“; at zero nothing is shown (no "0", no empty text – no overdue maintenance is the normal state of an entry).

## Acceptance Criteria

Scenario: Machine overview shows the number of overdue maintenance tasks
  Given "LG-042" has 2 overdue maintenance tasks and "LG-043" none
  When a team member opens the machine overview
  Then "LG-042" says that 2 maintenance tasks are overdue
  And "LG-043" shows nothing about overdue maintenance

Scenario: Recording removes the task from the count
  Given "LG-042" has 2 overdue maintenance tasks
  When a team member records one of them as done
  Then the machine overview shows 1 overdue maintenance task for "LG-042"

## Out of Scope
- Due (not yet overdue) tasks in the overview

## Open Questions
- none

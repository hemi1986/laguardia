---
id: ST-057
title: Number of overdue maintenance tasks in the machine overview
type: story
context: BC-Maintenance
priority: should
size: XS
risk: low
events: [EVT-MaintenanceTaskOverdue, EVT-MaintenanceRecorded]
depends_on: [ST-008, ST-043]
labels: [maintenance]
status: ready
---

## Story
As a technician, I want the machine overview to show the number of overdue maintenance tasks per machine, so that I spot neglected machines without opening every machine record.

## Context
Second part of the split of ST-047 (story review 2026-09-26). Read model `RM-MachineOverview` field "Number of overdue maintenance tasks". Overdue follows the rules of ST-043 and ST-056.

## Acceptance Criteria

Scenario: Machine overview shows the number of overdue maintenance tasks
  Given "LG-042" has 2 overdue maintenance tasks and "LG-043" none
  When a team member opens the machine overview
  Then "LG-042" shows 2 overdue maintenance tasks and "LG-043" none

Scenario: Recording removes the task from the count
  Given "LG-042" has 2 overdue maintenance tasks
  When a team member records one of them as done
  Then the machine overview shows 1 overdue maintenance task for "LG-042"

## Out of Scope
- Due (not yet overdue) tasks in the overview

## Open Questions
- none

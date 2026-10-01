---
id: ST-044
title: Record maintenance on a machine
type: story
context: BC-Maintenance
priority: must
size: S
risk: low
events: [EVT-MaintenanceRecorded]
depends_on: [ST-043]
labels: [mvp, maintenance, ui]
status: ready
---

## Story
As a helper, I want to record that I carried out a maintenance task on a machine, done or partially done, with an optional note, so that the task leaves the due list and the next maintenance is scheduled from the day I did it.

## Context
Command `CMD-RecordMaintenance` (any team member). Rules and invariants (`AGG-MaintenanceRecord`):
- The maintenance task applies to the machine's machine category and technology.
- Helpers can only record maintenance tasks suitable for helpers.
- The machine is not retired. Machines *Not on display* can be maintained; it counts and resets the interval (HS-13).
- Any machine the maintenance task applies to can be recorded, whether due or not; the interval restarts from the recorded date.
- The date may be up to 7 days in the past (default today), never in the future (decision D6).
- Outcome *done* or *partially done*; only *done* resets the interval.
- A maintenance record is never changed or removed.
- Maintenance can be recorded from the due maintenance list and from the machine record (ST-047).
UI wording (de): Wartungseintrag.

## Acceptance Criteria

Scenario: Helper records maintenance as done
  Given "Clean glass (inside & out)" (1 month, suitable for helpers) is due on "LG-042"
  When the helper Anna records it on "LG-042" as done on 10 June 2026
  Then a maintenance record by Anna with outcome done and the date 10 June 2026 exists for "LG-042"
  And "LG-042" is no longer listed as due for "Clean glass (inside & out)"
  And it is next due on 10 July 2026

Scenario: Recording a task that is not due restarts the interval
  Given "Clean glass (inside & out)" (1 month) was done on "LG-042" on 1 June 2026 and is not due
  When a team member records it on "LG-042" as done on 15 June 2026
  Then it is next due on 15 July 2026

Scenario: Back-dating up to 7 days
  Given today is 10 June 2026
  When a team member records "Clean glass (inside & out)" on "LG-042" as done on 3 June 2026
  Then the maintenance record has the date 3 June 2026
  And the task is next due on 3 July 2026

Scenario: No back-dating beyond 7 days
  Given today is 10 June 2026
  When a team member records maintenance with the date 2 June 2026
  Then the maintenance record is rejected

Scenario: No future dates
  Given today is 10 June 2026
  When a team member records maintenance with the date 11 June 2026
  Then the maintenance record is rejected

Scenario: The date defaults to today
  Given today is 10 June 2026
  When a team member records maintenance without choosing a date
  Then the maintenance record has the date 10 June 2026

Scenario: Partially done does not reset the interval
  Given "Switch test (every switch)" is due on "LG-042"
  When a team member records it as partially done with the note "Switch matrix row 3 not tested – shooter lane blocked"
  Then the maintenance record with outcome partially done and the note exists
  And "LG-042" stays listed as due for "Switch test (every switch)"

Scenario: Helpers can only record maintenance tasks suitable for helpers
  Given "Check fuses, connectors, boards for burn marks" is not suitable for helpers
  When the helper Anna tries to record it on "LG-042"
  Then the maintenance record is rejected

Scenario: Maintenance task must apply to the machine
  Given "Test joysticks, buttons, coin door" is restricted to Arcade
  When a team member tries to record it on the pinball machine "LG-042"
  Then the maintenance record is rejected

Scenario: Maintenance on a machine not on display counts
  Given the machine "LG-030" is Not on display
  When a technician records "Clean playfield" on "LG-030" as done
  Then the maintenance record exists and the interval counts from that day

Scenario: No maintenance on retired machines
  Given the machine "LG-013" is retired
  When a team member tries to record maintenance on "LG-013"
  Then the maintenance record is rejected

## Out of Scope
- Several machines at once (ST-045)
- Reporting a finding (ST-046)
- The maintenance section of the machine record (ST-047)

## Open Questions
- none

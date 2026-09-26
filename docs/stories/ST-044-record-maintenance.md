---
id: ST-044
title: Record maintenance on a machine
type: story
context: BC-Maintenance
priority: should
size: null
risk: null
events: [EVT-MaintenanceRecorded]
depends_on: [ST-043]
labels: [mvp, maintenance]
status: review
---

## Story
As a helper, I want to record that I carried out a maintenance task on a machine, done or partially done, with an optional note, so that the task leaves the due list and the next maintenance is scheduled from today.

## Context
Command `CMD-RecordMaintenance` (any team member). Rules and invariants (`AGG-MaintenanceRecord`):
- The maintenance task applies to the machine's machine category and technology.
- Helpers can only record maintenance tasks suitable for helpers.
- The machine is not retired. Machines *Not on display* can be maintained; it counts and resets the interval (HS-13).
- Outcome *done* or *partially done*; only *done* resets the interval.
- A maintenance record is never changed or removed.
UI wording (de): Wartungseintrag.

## Acceptance Criteria

Scenario: Helper records maintenance as done
  Given "Clean glass (inside & out)" (1 month, suitable for helpers) is due on "LG-042"
  When the helper Anna records it on "LG-042" as done on 10 June 2026
  Then a maintenance record by Anna with outcome done exists for "LG-042"
  And "LG-042" is no longer listed as due for "Clean glass (inside & out)"
  And it is next due on 10 July 2026

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

## Open Questions
- none

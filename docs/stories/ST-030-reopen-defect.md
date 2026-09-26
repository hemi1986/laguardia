---
id: ST-030
title: Reopen a resolved defect, optionally changing the machine status
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-DefectReopened, EVT-MachineStatusChanged]
depends_on: [ST-012, ST-028]
labels: [mvp, defect-work]
status: ready
---

## Story
As a team member, I want to reopen a resolved defect when the fault comes back, so that recurring faults stay visible with their full history instead of starting from scratch.

## Context
Command `CMD-ReopenDefect` (any team member, HS-7). Rules and invariants:
- The defect is resolved and its machine is not retired. A defect closed on retirement is final and cannot be reopened.
- A reason is required.
- A reopened defect is open, not on hold and unclaimed.
- No time limit; guideline: the same fault months later becomes a new defect (HS-7).
Manual policy `POL-DefectMayChangeMachineStatus`: when a technician reopens a defect, the technician may set the machine to *Limited* or *Out of order* in the same step; the status history reason refers to the reopened defect, as in ST-018. Helpers cannot change the machine status while reopening (they may still set *Out of order* separately, ST-012).
Reopening by linking a problem report follows in ST-053.

## Acceptance Criteria

Scenario: Team member reopens a resolved defect
  Given the defect "Left flipper weak" of "LG-042" was resolved yesterday
  When the helper Anna reopens it with the reason "Flipper weak again after an hour of play"
  Then "Left flipper weak" is open, not on hold and not claimed
  And it appears again in the open defects list and on the visitor machine page of "LG-042"
  And the earlier resolution with its closing note and the reopen reason are kept

Scenario: Technician changes the machine status while reopening
  Given "LG-042" is Playable and "Left flipper weak" is resolved
  When a technician reopens "Left flipper weak" and sets "LG-042" to Limited in the same step
  Then "Left flipper weak" is open
  And "LG-042" is Limited with a status history entry by that technician
  And the reason of that entry refers to "Left flipper weak"

Scenario: Helpers cannot change the machine status while reopening
  Given the helper Anna is logged in and "Left flipper weak" is resolved
  When Anna reopens it
  Then no machine status change is offered in the same step

Scenario: A reason is required
  When a team member reopens a resolved defect without a reason
  Then the action is rejected

Scenario: Open defects cannot be reopened
  Given "Display flickers" is open
  When a team member tries to reopen it
  Then the action is rejected

Scenario: No reopening on retired machines
  Given the machine "LG-013" is retired and its defect "Coin mech jammed" was resolved before
  When a team member tries to reopen "Coin mech jammed"
  Then the action is rejected

## Out of Scope
- Reopening by linking a problem report (ST-053)
- Defects closed on retirement (ST-039)

## Open Questions
- none

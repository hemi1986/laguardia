---
id: ST-030
title: Reopen a resolved defect, optionally changing the machine status
type: story
context: BC-Repair
priority: should
size: M
risk: low
events: [EVT-DefectReopened, EVT-MachineStatusChanged]
depends_on: [ST-012, ST-018, ST-028, ST-033]
labels: [mvp, defect-work, ui]
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
Repair history (ST-033): a defect keeps one resolution per resolve and one *Reopening* per reopen; a *Reopening* is an entry of its own with the reopen reason, shown after the resolution it followed (`docs/architecture/data-model.md`). So the repair history of the machine shows every closing note of a reopened defect, each followed by the reopen reason that came after it – moved here from ST-033 by the backlog grooming of 2026-10-11 (user, 2026-10-12), so that ST-033 does not wait for this story.

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

Scenario: Repair history shows every resolution of a reopened defect and the reopen reason
  Given "Left flipper weak" of "LG-042" was resolved with the closing note "Coil replaced", reopened with the reason "Weak again" and is open again
  When a team member opens the repair history of "LG-042"
  Then the closing note "Coil replaced" is shown, followed by the reopen reason "Weak again"

Scenario: Repair history keeps the order of several resolutions and reopenings
  Given "Left flipper weak" of "LG-042" was resolved with "Coil replaced", reopened with "Weak again", resolved with "Flipper rebuilt" and reopened with "Sticks when warm"
  When a team member opens the repair history of "LG-042"
  Then both closing notes and both reopen reasons are shown in the order they happened, each reopen reason after the resolution it followed

## Out of Scope
- Reopening by linking a problem report (ST-053)
- Defects closed on retirement (ST-039)

## Open Questions
- none

---
id: ST-029
title: Put a defect on hold and resume it
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectPutOnHold, EVT-DefectResumed]
depends_on: [ST-028]
labels: [mvp, defect-work]
status: review
---

## Story
As a technician, I want to put a defect on hold with a reason such as "waiting for part" and resume it later, so that everyone sees why an open defect doesn't progress.

## Context
Commands `CMD-PutDefectOnHold` and `CMD-ResumeDefect`. Rules and invariants:
- Only an open defect that is not on hold can be put on hold; only a defect on hold can be resumed.
- Only technicians or the team member who claimed the defect.
- A reason is required: *waiting for part*, *waiting for technician* or *other*; a note is optional.
- Resolving ends any hold (`AGG-Defect`).
The open defects list shows "on hold with reason" and gets the filter "on hold". UI wording (de): Pausiert.

## Acceptance Criteria

Scenario: Claimant puts a defect on hold
  Given the open defect "Display flickers" is claimed by the helper Anna
  When Anna puts it on hold with the reason waiting for part and the note "Ordered new flyback"
  Then "Display flickers" is on hold with that reason and note
  And the open defects list shows it as on hold – waiting for part

Scenario: Technician puts an unclaimed defect on hold
  Given the open defect "Left flipper weak" is not claimed
  When a technician puts it on hold with the reason waiting for technician
  Then "Left flipper weak" is on hold

Scenario: Others cannot put a defect on hold
  Given "Display flickers" is claimed by Anna
  When the helper Ben tries to put it on hold
  Then the action is rejected

Scenario: A reason is required
  When a technician puts an open defect on hold without a reason
  Then the action is rejected

Scenario: A defect on hold cannot be put on hold again
  Given "Display flickers" is on hold
  When a technician tries to put it on hold again
  Then the action is rejected

Scenario: Claimant resumes a defect
  Given "Display flickers" is on hold and claimed by Anna
  When Anna resumes it
  Then "Display flickers" is open and no longer on hold

Scenario: Only a defect on hold can be resumed
  Given "Left flipper weak" is open and not on hold
  When a technician tries to resume it
  Then the action is rejected

Scenario: Resolving ends the hold
  Given "Display flickers" is on hold
  When a technician resolves it with a closing note
  Then "Display flickers" is resolved and no longer on hold

Scenario: Filter "on hold"
  Given "Display flickers" is on hold and "Left flipper weak" is not
  When a team member filters the open defects list by on hold
  Then only "Display flickers" is listed

## Out of Scope
- Reminders for defects on hold for a long time

## Open Questions
- none

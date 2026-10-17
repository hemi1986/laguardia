---
id: ST-029
title: Put a defect on hold and resume it
type: story
context: BC-Repair
priority: should
size: S
risk: low
events: [EVT-DefectPutOnHold, EVT-DefectResumed]
depends_on: [ST-024, ST-028, ST-033]
labels: [mvp, defect-work, ui]
status: in-progress
---

## Story
As a team member working on a defect, I want to put a defect on hold with a reason such as "waiting for part" and resume it later, so that everyone sees why an open defect doesn't progress.

## Context
Commands `CMD-PutDefectOnHold` and `CMD-ResumeDefect`. Rules and invariants:
- Only an open defect that is not on hold can be put on hold; only a defect on hold can be resumed.
- Only technicians or the team member who claimed the defect.
- A reason is required: *waiting for part*, *waiting for technician* or *other*; a note is optional.
- Resolving ends any hold (`AGG-Defect`). Logging work does not resume a defect on hold.
The open defects list shows "on hold with reason" and gets the filter "on hold". UI wording (de): Pausiert.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G20, G21, G22):
- „Pausieren“ sits in the defect page's work group (G22) and leads to the page „Defekt pausieren · LG-042“ with the choice „Grund“ and the field „Notiz (optional)“; submit „Pausieren“.
- The reasons in glossary order, none preselected (G20): „Wartet auf Ersatzteil“, „Wartet auf Techniker:in“, „Anderer Grund“.
- Confirmation after putting on hold: „„Display flickers“ ist pausiert – Wartet auf Ersatzteil.“ – on the defect's page, whose header says the hold in words (G6, G22).
- „Fortsetzen“ stands in the place of „Pausieren“ while the defect is on hold and is **one tap**, without a form page (user, 2026-10-17, G22); confirmation „„Display flickers“ geht weiter.“
- The filter in the open defects list's filter form is the checkbox „Nur pausierte“; when it matches nothing the list says „Kein offener Defekt ist pausiert.“

The machine record lists a machine's open defects in its section 4 with the same facts and words as the open defects list (ST-033; owner of the page is ST-009, G18). This story adds the on-hold reason there – moved here from ST-033 by the backlog grooming of 2026-10-11 (user, 2026-10-12), so that ST-033 does not wait for this story.

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

Scenario: Logging work does not resume
  Given "Display flickers" is on hold with the reason waiting for part
  When a team member logs work on it with "Checked the connector while waiting"
  Then the work log entry is added
  And "Display flickers" is still on hold with the reason waiting for part

Scenario: Resolving ends the hold
  Given "Display flickers" is on hold
  When a technician resolves it with a closing note
  Then "Display flickers" is resolved and no longer on hold

Scenario: Filter "on hold"
  Given "Display flickers" is on hold and "Left flipper weak" is not
  When a team member filters the open defects list by on hold
  Then only "Display flickers" is listed

Scenario: Filter "on hold" without matches says so
  Given no open defect is on hold
  When a team member filters the open defects list by on hold
  Then no defect is listed
  And the list says that no open defect is on hold

Scenario: Machine record shows the on-hold reason of an open defect
  Given "LG-042" has the open defect "Rubber cracked", on hold with the reason waiting for part
  When a team member opens the machine record of "LG-042"
  Then "Rubber cracked" is shown among the open defects as on hold – waiting for part

## Out of Scope
- Reminders for defects on hold for a long time

## Open Questions
- none

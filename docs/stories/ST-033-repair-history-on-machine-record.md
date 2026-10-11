---
id: ST-033
title: Repair history on the machine record
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-DefectRecorded, EVT-WorkLogged, EVT-DefectResolved, EVT-ProblemResolvedOnTheSpot, EVT-DefectDetailsChanged]
depends_on: [ST-011, ST-019, ST-024]
labels: [mvp, defect-work, ui]
status: ready
---

## Story
As a technician, I want to see a machine's open defects and its complete repair history on its machine record, so that I know what was already tried and done before I start a repair.

## Context
Read model `RM-MachineRecord` – sections "Open defects" and "Repair history". Repair history (`CONTEXT.md`): all defects of a machine with their work log entries (and photos, if any), plus problem reports resolved on the spot. Each resolution keeps its closing note.
- Owner of the page is ST-009 (G18). Section 4 lists the machine's open defects with the same facts and words as the open defects list, each title leading to the defect's page; with none it says „Keine offenen Defekte.“ Section 7 shows the most recent repairs; the full repair history is the machine's own page, linked from there.
- This story shows what exists when it is built (backlog grooming 2026-10-11, user decision of 2026-10-12). What a later story adds to a defect, that story also shows here, each with its own scenario: the on-hold reason (ST-029), every resolution of a reopened defect with the reopen reason (ST-030), defects closed on retirement (ST-039).
- The machine record shows the open defects and the most recent repairs by default; the rest of the history is reached from there (G4a) – this story may not put five years of history on one phone page.
- A machine with nothing repaired yet says so (G7).

Success criterion (`docs/product/vision.md`): anyone on the team can see a machine's current status and full repair history in under a minute. As an automatable criterion: the QR address opens the machine status and the repair history directly, and the machine record loads in under 2 seconds with 5 years of realistic data for that machine.

## Acceptance Criteria

Scenario: Machine record shows open defects
  Given "LG-042" has the open defects "Left flipper weak" (high, claimed by Tom) and "Rubber cracked" (low, not claimed)
  When a team member opens the machine record of "LG-042"
  Then both open defects are shown with priority and claimant
  And each title leads to the defect's page

Scenario: A machine without open defects says so
  Given "LG-042" has no open defect
  When a team member opens the machine record of "LG-042"
  Then it says "Keine offenen Defekte."

Scenario: Repair history shows defects with their work log entries
  Given the defect "Coin door jammed" of "LG-042" has two work log entries and was resolved with the closing note "Lock replaced"
  When a team member opens the repair history of "LG-042"
  Then "Coin door jammed" is shown with both work log entries (who, when, what was done, parts used, photos if any) and the closing note

Scenario: Problems resolved on the spot are part of the repair history
  Given a problem report for "LG-042" was resolved on the spot with the note "Ball freed"
  When a team member opens the repair history of "LG-042"
  Then the problem report with its note, who resolved it and when is shown

Scenario: Dismissed problem reports are not part of the repair history
  Given a problem report for "LG-042" was dismissed as not a fault
  When a team member opens the repair history of "LG-042"
  Then that problem report is not shown

Scenario: A machine with no repair history
  Given "LG-042" has no defect and no problem report resolved on the spot
  When a team member opens the machine record of "LG-042"
  Then it says that nothing has been repaired on this machine yet

Scenario: Status and history directly from the QR address
  Given "LG-042" has 5 years of realistic repair history test data
  When a logged-in team member opens the QR address of "LG-042"
  Then the machine status and the repair history of "LG-042" are shown without further navigation
  And the page has loaded in under 2 seconds

## Out of Scope
- Maintenance records on the machine record (ST-047)
- The on-hold reason of an open defect on the machine record (ST-029)
- Reopened defects in the repair history: every resolution and the reopen reason (ST-030)
- Defects closed on retirement in the repair history (ST-039)

## Open Questions
- none

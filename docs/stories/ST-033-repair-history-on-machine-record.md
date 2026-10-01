---
id: ST-033
title: Repair history on the machine record
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-DefectRecorded, EVT-WorkLogged, EVT-DefectPutOnHold, EVT-DefectResumed, EVT-DefectResolved, EVT-DefectReopened, EVT-DefectClosedOnRetirement, EVT-ProblemResolvedOnTheSpot, EVT-DefectDetailsChanged]
depends_on: [ST-011, ST-019, ST-024, ST-029, ST-030, ST-039]
labels: [mvp, defect-work, ui]
status: ready
---

## Story
As a technician, I want to see a machine's open defects and its complete repair history on its machine record, so that I know what was already tried and done before I start a repair.

## Context
Read model `RM-MachineRecord` – sections "Open defects" and "Repair history". Repair history (`CONTEXT.md`): all defects of a machine with their work log entries (and photos, if any), plus problem reports resolved on the spot. Each resolution keeps its closing note and, if reopened, the reopen reason (`docs/architecture/data-model.md`). Defects closed on retirement are shown as *closed on retirement*, not as resolved.
- The machine record shows the open defects and the most recent repairs by default; the rest of the history is reached from there (G4a) – this story may not put five years of history on one phone page.
- A machine with nothing repaired yet says so (G7).

Success criterion (`docs/product/vision.md`): anyone on the team can see a machine's current status and full repair history in under a minute. As an automatable criterion: the QR address opens the machine status and the repair history directly, and the machine record loads in under 2 seconds with 5 years of realistic data for that machine.

## Acceptance Criteria

Scenario: Machine record shows open defects
  Given "LG-042" has the open defects "Left flipper weak" (high, claimed by Tom) and "Rubber cracked" (low, on hold)
  When a team member opens the machine record of "LG-042"
  Then both open defects are shown with priority, claimant and on-hold reason

Scenario: Repair history shows defects with their work log entries
  Given the defect "Coin door jammed" of "LG-042" has two work log entries and was resolved with the closing note "Lock replaced"
  When a team member opens the repair history of "LG-042"
  Then "Coin door jammed" is shown with both work log entries (who, when, what was done, parts used, photos if any) and the closing note

Scenario: Reopened defects show every resolution
  Given "Left flipper weak" was resolved, reopened with the reason "Weak again" and is open again
  When a team member opens the repair history of "LG-042"
  Then the first closing note and the reopen reason are both shown

Scenario: Problems resolved on the spot are part of the repair history
  Given a problem report for "LG-042" was resolved on the spot with the note "Ball freed"
  When a team member opens the repair history of "LG-042"
  Then the problem report with its note, who resolved it and when is shown

Scenario: Defects closed on retirement are shown as such
  Given the retired machine "LG-013" had the defect "Display dead" closed on retirement
  When a team member opens the repair history of "LG-013"
  Then "Display dead" is shown as closed on retirement, not as resolved

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

## Open Questions
- none

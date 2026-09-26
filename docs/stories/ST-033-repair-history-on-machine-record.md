---
id: ST-033
title: Repair history on the machine record
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectRecorded, EVT-WorkLogged, EVT-DefectPutOnHold, EVT-DefectResumed, EVT-DefectResolved, EVT-DefectReopened, EVT-ProblemResolvedOnTheSpot, EVT-DefectDetailsChanged]
depends_on: [ST-011, ST-019, ST-024, ST-029, ST-030]
labels: [mvp, defect-work]
status: review
---

## Story
As a technician, I want to see a machine's open defects and its complete repair history on its machine record, so that I know what was already tried and done before I start a repair.

## Context
Read model `RM-MachineRecord` – sections "Open defects" and "Repair history". Repair history (`CONTEXT.md`): all defects of a machine with their work log entries (and photos), plus problem reports resolved on the spot. Each resolution keeps its closing note and, if reopened, the reopen reason (`docs/architecture/data-model.md`).
Success criterion (`docs/product/vision.md`): anyone on the team can see a machine's current status and full repair history in under a minute.

## Acceptance Criteria

Scenario: Machine record shows open defects
  Given "LG-042" has the open defects "Left flipper weak" (high, claimed by Tom) and "Rubber cracked" (low, on hold)
  When a team member opens the machine record of "LG-042"
  Then both open defects are shown with priority, claimant and on-hold reason

Scenario: Repair history shows defects with their work log entries
  Given the defect "Coin door jammed" of "LG-042" has two work log entries and was resolved with the closing note "Lock replaced"
  When a team member opens the repair history of "LG-042"
  Then "Coin door jammed" is shown with both work log entries (who, when, what was done, parts used, photos) and the closing note

Scenario: Reopened defects show every resolution
  Given "Left flipper weak" was resolved, reopened with the reason "Weak again" and is open again
  When a team member opens the repair history of "LG-042"
  Then the first closing note and the reopen reason are both shown

Scenario: Problems resolved on the spot are part of the repair history
  Given a problem report for "LG-042" was resolved on the spot with the note "Ball freed"
  When a team member opens the repair history of "LG-042"
  Then the problem report with its note, who resolved it and when is shown

Scenario: Dismissed problem reports are not part of the repair history
  Given a problem report for "LG-042" was dismissed as not a fault
  When a team member opens the repair history of "LG-042"
  Then that problem report is not shown

Scenario: Status and history within a minute
  Given a team member stands at "LG-042" with a logged-in phone
  When the team member scans the QR sticker of "LG-042"
  Then the machine status and the repair history of "LG-042" are visible in under a minute, without searching

## Out of Scope
- Maintenance records on the machine record (ST-047)

## Open Questions
- none

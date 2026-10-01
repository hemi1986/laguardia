---
id: ST-053
title: Linking a problem report to a recently resolved defect reopens it
type: story
context: BC-Repair
priority: must
size: S
risk: medium
events: [EVT-ProblemReportLinkedToDefect, EVT-DefectReopened, EVT-MachineStatusChanged]
depends_on: [ST-022, ST-030]
labels: [mvp, defect-work, triage, ui]
status: ready
---

## Story
As a technician, I want to link a new problem report to a recently resolved defect of the same machine, which reopens it, so that a fault that comes back soon after a repair continues its history instead of becoming a duplicate defect.

## Context
Second part of the split of ST-030 (story review 2026-09-26).
- Automatic policy `POL-LinkReopensResolvedDefect`: linking a problem report to a resolved defect reopens it, with the linked problem report as reason; the link and the reopening are stored together.
- The triage list offers the machine's open **and recently resolved** defects for linking (`RM-TriageList`); "recently resolved" means resolved within the last 30 days (Europe/Berlin calendar days, ST-003).
- Manual policy `POL-DefectMayChangeMachineStatus`: the technician may set the machine to *Limited* or *Out of order* in the same step as the link; the status history reason refers to the reopened defect.
- All rules of `CMD-LinkProblemReportToDefect` (ST-022) and `CMD-ReopenDefect` (ST-030) apply.

## Acceptance Criteria

Scenario: Recently resolved defects are offered for linking
  Given the defect "Left flipper weak" of "LG-042" was resolved 3 days ago
  And a problem report for "LG-042" is untriaged
  When a technician looks at that problem report in the triage list
  Then "Left flipper weak" is offered for linking as a resolved defect

Scenario: Defects resolved longer ago are not offered for linking
  Given the defect "Coin door jammed" of "LG-042" was resolved 31 days ago
  And a problem report for "LG-042" is untriaged
  When a technician looks at that problem report in the triage list
  Then "Coin door jammed" is not offered for linking

Scenario: Linking a problem report to a resolved defect reopens it
  Given the defect "Left flipper weak" of "LG-042" is resolved
  When a technician links an untriaged problem report of "LG-042" to it
  Then the problem report is triaged with the outcome linked
  And "Left flipper weak" is reopened with that problem report as reason
  And it is open, not on hold and not claimed

Scenario: Link and machine status change in the same step
  Given "LG-042" is Playable and "Left flipper weak" is resolved
  When a technician links an untriaged problem report of "LG-042" to "Left flipper weak" and sets "LG-042" to Out of order in the same step
  Then "Left flipper weak" is open
  And "LG-042" is Out of order with a status history entry referring to "Left flipper weak"

Scenario: Link fails, nothing is reopened
  Given "Left flipper weak" of "LG-042" is resolved
  And another technician triaged the problem report a moment ago
  When a technician links that problem report to "Left flipper weak"
  Then the action is rejected
  And "Left flipper weak" stays resolved

## Out of Scope
- Reopening without a problem report (ST-030)

## Open Questions
- none

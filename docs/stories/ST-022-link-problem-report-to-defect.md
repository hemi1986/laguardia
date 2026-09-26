---
id: ST-022
title: Triage – link a problem report to an open defect
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReportLinkedToDefect]
depends_on: [ST-018]
labels: [mvp, triage]
status: review
---

## Story
As a technician, I want to link a problem report to an already known defect of the same machine, so that duplicate reports don't create duplicate defects but still count as evidence for that defect.

## Context
Command `CMD-LinkProblemReportToDefect` (technicians only). Rules and invariants:
- The problem report has not been triaged yet.
- The defect belongs to the same machine as the problem report.
- A linked problem report refers to exactly one defect; the outcome never changes.
The triage list (ST-017) shows the open defects of the machine next to each problem report for linking. The open defects list shows the number of linked problem reports.
Linking to a *resolved* defect reopens it automatically (`POL-LinkReopensResolvedDefect`) – see ST-030.

## Acceptance Criteria

Scenario: Open defects of the machine are offered for linking
  Given "LG-042" has the open defect "Left flipper weak"
  And a problem report for "LG-042" is untriaged
  When a technician looks at that problem report in the triage list
  Then the open defect "Left flipper weak" is offered for linking

Scenario: Technician links a problem report to an open defect
  Given the open defect "Left flipper weak" of "LG-042"
  And the untriaged visitor problem report "Flipper on the left does nothing" for "LG-042"
  When a technician links the problem report to "Left flipper weak"
  Then the problem report is triaged with the outcome linked, referring to "Left flipper weak"
  And the open defects list shows 1 linked problem report for "Left flipper weak"

Scenario: Defect of another machine cannot be linked
  Given the open defect "Display flickers" belongs to "LG-007"
  When a technician tries to link a problem report of "LG-042" to "Display flickers"
  Then the action is rejected
  And the problem report stays untriaged

Scenario: Already triaged problem report
  Given a problem report was dismissed a moment ago
  When a technician tries to link the same problem report to a defect
  Then the action is rejected with the message that it was already triaged

Scenario: Helpers cannot link
  Given a helper is logged in
  When the helper tries to link a problem report to a defect
  Then the action is rejected

## Out of Scope
- Linking to a resolved defect, which reopens it (ST-030)

## Open Questions
- none

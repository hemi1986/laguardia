---
id: ST-015
title: Team member reports a problem from the machine record
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-ProblemReported]
depends_on: [ST-009, ST-013]
labels: [mvp, triage, ui]
status: in-progress
---

## Story
As a helper, I want to report a problem from the machine record, also for machines that are not on display, so that faults I notice are triaged like every other problem report and don't get lost.

## Context
Command `CMD-ReportProblem`, used by team members. Rules:
- Team members can report for any machine that is not retired – including machines that are *Not on display*.
- A description is required; a photo is optional (ST-016).
- The reporter is the team member.
- Every problem report is triaged by a technician (`docs/product/vision.md`). A technician's own problem report is triaged in the same step – see ST-023.

## Acceptance Criteria

Scenario: Helper reports a problem
  Given the machine "LG-042" is Playable
  When the helper Anna reports a problem for "LG-042" from its machine record with the description "Rubber on the left slingshot cracked"
  Then a problem report for "LG-042" exists with Anna as reporter
  And it waits for triage

Scenario: Team members can report for machines not on display
  Given the machine "LG-030" is Not on display
  When a helper reports a problem for "LG-030"
  Then the problem report is recorded

Scenario: Description is required
  When a helper reports a problem for "LG-042" without a description
  Then the problem report is rejected

Scenario: No problem reports for retired machines
  Given the machine "LG-013" is retired
  When a team member tries to report a problem for "LG-013"
  Then the problem report is rejected

## Out of Scope
- Photo (ST-016)
- Technician's own problem report triaged in the same step (ST-023)
- Findings during maintenance (ST-046)

## Open Questions
- none

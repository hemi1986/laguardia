---
id: ST-023
title: Technician reports a problem and records a defect in the same step
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-MachineStatusChanged]
depends_on: [ST-015, ST-018]
labels: [mvp, triage]
status: ready
---

## Story
As a technician, I want to report a fault I found and record it as a defect in the same step, optionally changing the machine status, so that I don't have to triage my own problem reports later in the triage list.

## Context
`docs/product/vision.md`: every problem report – also from team members – is triaged by a technician; technicians triage their own reports in the same step. `CMD-ReportProblem`: a technician's own problem report is triaged in the same step.
- For technicians the triage outcome is **mandatory**: a technician's problem report is never stored untriaged and never appears in the triage list.
- This story covers the outcome *record a defect*, optionally with a machine status change (*Limited* or *Out of order*, as in ST-018). All rules of `CMD-ReportProblem` and `CMD-RecordDefect` apply. The outcomes *link* and *resolve on the spot*, and the helper variant, follow in ST-052.
- The problem report and its triage are stored together: if the triage part is rejected, the problem report is not stored either.
- A problem report describing two faults leads to one defect; the technician records further faults as own problem reports (HS-4).

## Acceptance Criteria

Scenario: Technician reports and records a defect in one step
  Given the machine "LG-042" is Playable
  When the technician Tom reports "Left flipper coil stop broken" for "LG-042" and records the defect "Left flipper sticks" with the machine status Limited in the same step
  Then a problem report by Tom exists with the outcome defect recorded
  And the defect "Left flipper sticks" is open
  And "LG-042" is Limited
  And the problem report never appears in the triage list

Scenario: Technician's problem report needs a triage outcome
  When a technician reports a problem for "LG-042" without choosing a triage outcome
  Then the problem report is not stored
  And the technician is asked to choose an outcome

Scenario: Invalid triage part stores nothing
  When a technician reports a problem for "LG-042" and records a defect without a title in the same step
  Then neither the problem report nor a defect is stored

Scenario: Two faults become two own problem reports
  Given a technician found two faults on "LG-042"
  When the technician reports and records the first fault and then reports and records the second fault
  Then "LG-042" has two problem reports by that technician, each with its own defect

## Out of Scope
- Linking and resolving on the spot in the same step, helpers (ST-052)
- Dismissing one's own problem report (makes no sense for a fault the technician just found)

## Open Questions
- none

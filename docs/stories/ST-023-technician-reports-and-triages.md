---
id: ST-023
title: Report a problem and triage it in the same step
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-ProblemReportLinkedToDefect, EVT-ProblemResolvedOnTheSpot, EVT-MachineStatusChanged]
depends_on: [ST-015, ST-018, ST-019, ST-022]
labels: [mvp, triage]
status: review
---

## Story
As a technician, I want to report a fault I found and triage it in the same step, so that I don't have to triage my own problem reports later in the triage list.

## Context
`docs/product/vision.md`: every problem report – also from team members – is triaged by a technician; technicians triage their own reports in the same step. `CMD-ReportProblem`: a technician's own problem report is triaged in the same step.
- The technician chooses the triage outcome together with the report: record a defect (optionally with a machine status change, as in ST-018), link to an open defect of the machine (ST-022) or resolve on the spot (ST-019). All rules of those commands apply.
- The problem report and its triage are stored together: if the triage part is rejected, the problem report is not stored either.
- A problem report describing two faults leads to one defect; the technician records further faults as own problem reports (HS-4).
- Helpers may report and resolve on the spot in the same step (e.g. a stuck ball they just freed) – the only triage outcome helpers may choose (`CMD-ResolveProblemOnTheSpot`). Otherwise a helper's problem report waits in the triage list.

## Acceptance Criteria

Scenario: Technician reports and records a defect in one step
  Given the machine "LG-042" is Playable
  When the technician Tom reports "Left flipper coil stop broken" for "LG-042" and records the defect "Left flipper sticks" with the machine status Limited in the same step
  Then a problem report by Tom exists with the outcome defect recorded
  And the defect "Left flipper sticks" is open
  And "LG-042" is Limited
  And the problem report never appears in the triage list

Scenario: Technician reports and resolves on the spot in one step
  When a technician reports "Ball stuck in the shooter lane" for "LG-042" and resolves it on the spot with the note "Freed the ball" in the same step
  Then a problem report by that technician exists with the outcome resolved on the spot
  And no defect is created

Scenario: Technician reports and links in one step
  Given "LG-042" has the open defect "Left flipper weak"
  When a technician reports "Left flipper weak again during test" and links it to "Left flipper weak" in the same step
  Then the problem report is triaged with the outcome linked

Scenario: Invalid triage part stores nothing
  When a technician reports a problem for "LG-042" and records a defect without a title in the same step
  Then neither the problem report nor a defect is stored

Scenario: Helper reports and resolves on the spot in one step
  When the helper Anna reports "Ball stuck behind the left ramp" for "LG-042" and resolves it on the spot with the note "Ball freed" in the same step
  Then a problem report by Anna exists with the outcome resolved on the spot
  And it never appears in the triage list

Scenario: Helpers cannot choose other triage outcomes in the same step
  When the helper Anna reports a problem for "LG-042" and tries to record a defect in the same step
  Then neither the problem report nor a defect is stored

Scenario: Helpers' other problem reports still go to the triage list
  When a helper reports a problem for "LG-042" without resolving it on the spot
  Then the problem report is untriaged and appears in the triage list

## Out of Scope
- Dismissing one's own problem report (makes no sense for a fault the technician just found)

## Open Questions
- none

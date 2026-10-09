---
id: ST-052
title: Report a problem and link it or resolve it on the spot in the same step
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-ProblemReported, EVT-ProblemReportLinkedToDefect, EVT-ProblemResolvedOnTheSpot]
depends_on: [ST-019, ST-022, ST-023]
labels: [mvp, triage, ui]
status: review
---

## Story
As a team member who just found and handled a problem at a machine, I want to report it and link it to a known defect or mark it as resolved on the spot in the same step, so that my own findings don't wait in the triage list.

## Context
Second part of the split of ST-023 (story review 2026-09-26). All rules of `CMD-ReportProblem`, `CMD-LinkProblemReportToDefect` (ST-022) and `CMD-ResolveProblemOnTheSpot` (ST-019) apply.
- Technicians may choose, besides recording a defect (ST-023), the outcomes *link to an open defect of the machine* and *resolve on the spot*. For technicians an outcome stays mandatory.
- Helpers may report and resolve on the spot in the same step (e.g. a stuck ball they just freed) – the only triage outcome helpers may choose. Otherwise a helper's problem report waits in the triage list.
- The problem report and its triage are stored together: if the triage part is rejected, the problem report is not stored either.
- Form (ST-023, `docs/reviews/ST-023-ux-form.md`, user 2026-10-10; no change in scope): for technicians the outcomes „Mit Defekt verknüpfen“ (only when the machine has open defects; otherwise „LG-042 hat keine offenen Defekte.“) and „Direkt behoben“ become buttons in the section „Sichten“ of `/team/machines/<museum number>/melden`, in ST-023's order („Mit Defekt verknüpfen“, „Defekt erfassen“, „Direkt behoben“), each with a form page of its own that also has the problem report's fields (section „Meldung“), sent once, and each lands on the machine record with its confirmation. How a helper reaches „Direkt behoben“ in the same step – helpers see ST-015's plain form on `/melden` (G11) – is ST-052's open UX point.

## Acceptance Criteria

Scenario: Technician reports and resolves on the spot in one step
  When a technician reports "Ball stuck in the shooter lane" for "LG-042" and resolves it on the spot with the note "Freed the ball" in the same step
  Then a problem report by that technician exists with the outcome resolved on the spot
  And no defect is created

Scenario: Technician reports and links in one step
  Given "LG-042" has the open defect "Left flipper weak"
  When a technician reports "Left flipper weak again during test" and links it to "Left flipper weak" in the same step
  Then the problem report is triaged with the outcome linked

Scenario: Helper reports and resolves on the spot in one step
  When the helper Anna reports "Ball stuck behind the left ramp" for "LG-042" and resolves it on the spot with the note "Ball freed" in the same step
  Then a problem report by Anna exists with the outcome resolved on the spot
  And it never appears in the triage list

Scenario: Helpers cannot choose other triage outcomes in the same step
  When the helper Anna reports a problem for "LG-042" and tries to record a defect or link it in the same step
  Then neither the problem report nor a defect is stored

Scenario: Missing note stores nothing
  When the helper Anna reports a problem for "LG-042" and resolves it on the spot without a note in the same step
  Then the problem report is not stored

Scenario: Helpers' other problem reports still go to the triage list
  When a helper reports a problem for "LG-042" without resolving it on the spot
  Then the problem report is untriaged and appears in the triage list

## Out of Scope
- Recording a defect in the same step (ST-023)

## Open Questions
- none

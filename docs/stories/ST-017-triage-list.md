---
id: ST-017
title: Triage list of untriaged problem reports
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported]
depends_on: [ST-013, ST-015]
labels: [mvp, triage]
status: review
---

## Story
As a technician, I want to see all untriaged problem reports with their machine, description, photo and the machine's known defects, so that I can triage every problem report and none gets lost.

## Context
Read model `RM-TriageList`; manual routine `POL-TriageProblemReports`. Fields: museum number, machine model title, description, photo, reporter (visitor or team member name), reported at, waiting longer than 3 days (HS-2), open and recently resolved defects of the machine (for linking).
Helpers use the triage list only to resolve problems on the spot (ST-019). Triage actions: ST-018 (record defect), ST-019 (resolve on the spot), ST-020 (dismiss), ST-022 (link).

## Acceptance Criteria

Scenario: Technician sees untriaged problem reports
  Given a visitor reported "Ball stuck behind the left ramp" for "LG-042" at 14:05
  And the helper Anna reported "Rubber cracked" for "LG-007" at 15:10
  When a technician opens the triage list
  Then both problem reports are listed with museum number, machine model title, description, photo if any, reporter ("visitor" or "Anna") and time reported
  And the oldest problem report comes first

Scenario: Problem reports waiting longer than 3 days are highlighted
  Given a problem report for "LG-042" was reported 4 days ago and is untriaged
  When a technician opens the triage list
  Then that problem report is highlighted as waiting longer than 3 days

Scenario: Triaged problem reports leave the list
  Given a problem report for "LG-042" has been triaged
  When a technician opens the triage list
  Then that problem report is not listed

Scenario: Visitors cannot open the triage list
  Given nobody is logged in
  When the triage list is opened
  Then the login is requested first

## Out of Scope
- The triage actions themselves (ST-018, ST-019, ST-020, ST-022)
- Open and recently resolved defects of the machine shown for linking (ST-022, ST-030)
- Highlighting on the technician dashboard (ST-048)

## Open Questions
- none

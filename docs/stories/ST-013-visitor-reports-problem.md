---
id: ST-013
title: Visitor reports a problem at the machine
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported]
depends_on: [ST-010]
labels: [mvp, visitor]
status: review
---

## Story
As a visitor, I want to describe a problem with the machine I am standing at on its visitor machine page, without an account or contact data, so that the team learns about it and can fix it.

## Context
Command `CMD-ReportProblem` (actor: visitor). Rules:
- Visitors can report only for machines that are not *Not on display* and not retired.
- A description is required; a photo is optional (ST-016).
- No account, no contact data (`docs/product/vision.md`). The reporter is recorded as *visitor* without further data.
- The visitor machine page shows only the number of untriaged problem reports, never their text (HS-1). The number counts all untriaged problem reports of the machine, not only today's, and the wording contains no "today".
- The report form is in German and English like the visitor machine page (ST-010).

## Acceptance Criteria

Scenario: Visitor reports a problem
  Given the machine "LG-042" is Playable
  When a visitor reports a problem for "LG-042" with the description "Ball stuck behind the left ramp"
  Then a problem report for "LG-042" exists with that description, the reporter visitor and the time it was reported
  And the visitor sees a confirmation in the visitor's language

Scenario: Visitor machine page shows the number of untriaged problem reports
  Given two untriaged problem reports exist for "LG-042", one reported today and one yesterday
  When a visitor opens the visitor machine page of "LG-042"
  Then the page says that the machine has already been reported 2 times and not yet triaged
  And the descriptions of these problem reports are not shown

Scenario: Description is required
  When a visitor reports a problem for "LG-042" with an empty description
  Then the problem report is rejected
  And the visitor is asked to describe the problem

Scenario: No reporting for machines not on display
  Given the machine "LG-030" is Not on display
  When a visitor tries to report a problem for "LG-030"
  Then the problem report is rejected

Scenario: No contact data is asked for
  When a visitor reports a problem
  Then no name, e-mail address or other contact data is requested or stored

## Out of Scope
- Photo (ST-016), spam protection (ST-014)
- Retired machines (ST-039)

## Open Questions
- none

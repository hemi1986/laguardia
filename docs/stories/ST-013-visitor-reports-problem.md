---
id: ST-013
title: Visitor reports a problem at the machine
type: story
context: BC-Repair
priority: must
size: M
risk: medium
events: [EVT-ProblemReported]
depends_on: [ST-010]
labels: [mvp, visitor, ui]
status: ready
---

## Story
As a visitor, I want to describe a problem with the machine I am standing at on its visitor machine page, without an account or contact data, so that the team learns about it and can fix it.

## Context
Command `CMD-ReportProblem` (actor: visitor). Rules:
- Visitors can report only for machines that are not *Not on display* and not retired.
- A description is required and has at most 2000 characters; a photo is optional (ST-016).
- No account, no contact data (`docs/product/vision.md`). The reporter is recorded as *visitor* without further data.
- The visitor machine page shows only the number of untriaged problem reports, never their text (HS-1). The number counts all untriaged problem reports of the machine, not only today's, and the wording contains no "today". With no untriaged problem report, no hint is shown; with one, the wording is singular.
- The report form is in German and English like the visitor machine page (ST-010) and is protected against cross-site request forgery (ST-003). Report texts are always shown to team members as plain text (output encoding), never interpreted.
- No rate limits in the MVP (decision D3): spam is considered unlikely and is handled by dismissing it as spam (ST-020). Rate limits follow only if spam actually occurs (ST-014).

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

Scenario: One untriaged problem report is shown in singular
  Given exactly one untriaged problem report exists for "LG-042"
  When a visitor opens the visitor machine page of "LG-042"
  Then the page says that the machine has already been reported once and not yet triaged

Scenario: No hint without untriaged problem reports
  Given no untriaged problem report exists for "LG-042"
  When a visitor opens the visitor machine page of "LG-042"
  Then the page shows no hint about earlier reports

Scenario: Description is required
  When a visitor reports a problem for "LG-042" with an empty description
  Then the problem report is rejected
  And the visitor is asked to describe the problem

Scenario: Overlong description
  When a visitor reports a problem with a description longer than 2000 characters
  Then the problem report is rejected with the maximum length shown
  And the typed description is kept in the form

Scenario: Report text is never interpreted
  Given a visitor reported a problem with the description "<script>alert(1)</script>"
  When a technician opens the triage list
  Then the description is shown as that literal text

Scenario: No reporting for machines not on display
  Given the machine "LG-030" is Not on display
  When a visitor tries to report a problem for "LG-030"
  Then the problem report is rejected

Scenario: No contact data is asked for
  When a visitor reports a problem
  Then no name, e-mail address or other contact data is requested or stored

## Out of Scope
- Photo (ST-016)
- Rate limits and honeypot (ST-014, only if spam occurs)
- Retired machines (ST-039, ST-055)

## Open Questions
- none

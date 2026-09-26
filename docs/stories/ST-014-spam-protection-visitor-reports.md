---
id: ST-014
title: Spam protection for visitor problem reports
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported]
depends_on: [ST-013]
labels: [mvp, visitor]
status: review
---

## Story
As a technician, I want automated and abusive problem reports from the public visitor page to be held back, so that the triage list only contains real problem reports and triage stays quick.

## Context
Decision in `docs/adr/0001-tech-stack.md` (Open Points): start without CAPTCHA – a hidden honeypot field, a rate limit per client and per machine, image type/size limits and re-encoding (images: ST-002, ST-016). A privacy-friendly CAPTCHA is added only if spam actually appears.
Limits: at most 3 problem reports per client per 10 minutes, at most 10 problem reports per machine per hour, description at most 2000 characters.

## Acceptance Criteria

Scenario: A bot filling the hidden field is ignored
  Given the report form of "LG-042" contains a hidden field that visitors do not see
  When a problem report is submitted with that hidden field filled in
  Then no problem report is recorded
  And the submitter sees the same confirmation as a real visitor

Scenario: Too many problem reports from one client
  Given 3 problem reports were submitted from the same client within the last 10 minutes
  When a fourth problem report is submitted from that client
  Then it is rejected
  And the visitor is asked in the visitor's language to try again later

Scenario: Too many problem reports for one machine
  Given 10 problem reports were recorded for "LG-042" within the last hour
  When another visitor submits a problem report for "LG-042"
  Then it is rejected
  And the visitor is told that the machine has already been reported several times

Scenario: Overlong description
  When a visitor submits a problem report with a description longer than 2000 characters
  Then it is rejected with the maximum length shown

Scenario: Normal visitors are not bothered
  Given no problem report was submitted from a client today
  When a visitor from that client reports a problem
  Then the problem report is recorded without any CAPTCHA or extra step

## Out of Scope
- CAPTCHA (only if spam appears)
- Dismissing spam that got through (ST-020)

## Open Questions
- none

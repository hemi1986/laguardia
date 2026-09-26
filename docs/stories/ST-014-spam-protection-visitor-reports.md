---
id: ST-014
title: Spam protection for visitor problem reports – only if spam occurs
type: story
context: BC-Repair
priority: could
size: M
risk: medium
events: [EVT-ProblemReported]
depends_on: [ST-013]
labels: [visitor]
status: ready
---

## Story
As a technician, I want automated and abusive problem reports from the public visitor page to be held back once spam actually appears, so that the triage list only contains real problem reports and triage stays quick.

## Context
**Deferred (decision D3, 2026-09-27):** the MVP has no rate limits at all – spam is considered unlikely, and dismissing a problem report as spam (ST-020) removes its text and photo. This story is only implemented if spam actually occurs; its details are revisited then.
Input validation is not part of this story and is in the MVP: description at most 2000 characters (ST-013), photo type and size limits and re-encoding (ST-002, ST-016).
Starting points from the story review 2026-09-26, to be confirmed when this story is picked up:
- A hidden honeypot field that visitors do not see.
- "Per client" must not mean per IP address: many visitors share the museum Wi-Fi. An anonymous browser token is the better client identifier; counters are kept in the database, identifiers only hashed and only for the limit window.
- A limit per machine.
- The privacy notice (ST-064) then mentions the identifiers.

## Acceptance Criteria

Scenario: A bot filling the hidden field is ignored
  Given the report form of "LG-042" contains a hidden field that visitors do not see
  When a problem report is submitted with that hidden field filled in
  Then no problem report is recorded
  And the submitter sees the same confirmation as a real visitor

Scenario: Too many problem reports from one browser
  Given the limit per browser is reached for a visitor's browser
  When another problem report is submitted from that browser
  Then it is rejected
  And the visitor is asked in the visitor's language to try again later

Scenario: Visitors on the shared museum Wi-Fi are limited separately
  Given the limit per browser is reached for one visitor's browser
  When another visitor on the same museum Wi-Fi reports a problem from their own phone
  Then that problem report is recorded

Scenario: Too many problem reports for one machine
  Given the limit per machine is reached for "LG-042"
  When another visitor submits a problem report for "LG-042"
  Then it is rejected
  And the visitor is told that the machine has already been reported several times

Scenario: Normal visitors are not bothered
  Given no problem report was submitted from a browser today
  When a visitor reports a problem from that browser
  Then the problem report is recorded without any CAPTCHA or extra step

## Out of Scope
- CAPTCHA
- Input validation (ST-013, ST-016 – in the MVP)

## Open Questions
- none

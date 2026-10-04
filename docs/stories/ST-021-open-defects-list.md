---
id: ST-021
title: Open defects list and defect details
type: story
context: BC-Repair
priority: must
size: M
risk: low
events: [EVT-DefectRecorded]
depends_on: [ST-008, ST-018]
labels: [mvp, defect-work, ui]
status: in-progress
---

## Story
As a team member, I want to see all open defects, filter them and open a single defect, so that I know what needs to be done and can pick something to work on.

## Context
Read model `RM-OpenDefects`: museum number, machine model title, title, priority, suitable for helpers, claimed by, on hold with reason, number of linked problem reports, open since, last work log entry. Filterable by machine, priority, suitable for helpers, claimed by me, on hold.
- Order: by priority (high first), within a priority the oldest defect first.
- This story delivers the list with the filters machine, priority and suitable for helpers, and the defect details: machine, title, priority, suitable-for-helpers mark, open since, the originating problem report and all linked problem reports with their descriptions. All work log entries are added to the details by ST-024, photos by ST-016. Claim, hold and work log columns and filters are added by ST-024, ST-025 and ST-029.
- Also: the machine overview (ST-008) shows the number of open defects per machine. Which facts an overview entry carries, and that a count is labelled in words and not shown when it is zero, was decided in ST-008 – this story adds to that decision, it does not reopen it.
- The empty case and a filter that matches nothing say what to do about them, and how many defects are open is said in words (G7, G6).
- **This story is where a defect first has a page of its own** (user's decision, backlog grooming 2026-10-01). A technician who records a defect lands back on the triage list with a confirmation (ST-018, G2a) – the assertion that the defect is shown with its machine belongs here, and the scenario "Team member opens a defect" covers it.

## Acceptance Criteria

Scenario: Team member sees all open defects
  Given "LG-042" has the open defect "Left flipper weak" (high) recorded 5 days ago
  And "LG-007" has the open defect "Display flickers" (normal)
  When a team member opens the open defects list
  Then both defects are listed with museum number, machine model title, title, priority, suitable for helpers and open since
  And "Left flipper weak" comes before "Display flickers" because of its higher priority

Scenario: Oldest first within a priority
  Given the open defects "Rubber cracked" (normal, open since 10 days) and "Display flickers" (normal, open since 2 days)
  When a team member opens the open defects list
  Then "Rubber cracked" comes before "Display flickers"

Scenario: Filter by suitable for helpers
  Given "Rubber cracked" is suitable for helpers and "Display flickers" is not
  When a team member filters the open defects by suitable for helpers
  Then only "Rubber cracked" is listed

Scenario: Filter by machine
  When a team member filters the open defects by the machine "LG-042"
  Then only open defects of "LG-042" are listed

Scenario: Team member opens a defect
  When a team member opens the defect "Left flipper weak"
  Then its machine, title, priority, suitable-for-helpers mark, open since and the originating problem report with its description are shown

Scenario: Defect details show all linked problem reports
  Given two problem reports were linked to "Left flipper weak"
  When a team member opens the defect "Left flipper weak"
  Then the originating problem report and both linked problem reports are shown with description, reporter and time

Scenario: Machine overview shows the number of open defects
  Given "LG-042" has 2 open defects and 1 resolved defect
  When a team member opens the machine overview
  Then "LG-042" shows 2 open defects

Scenario: No defect is open
  Given no defect is open
  When a team member opens the open defects list
  Then it says that no defect is open

Scenario: How many defects are open
  Given 7 defects are open
  When a team member opens the open defects list
  Then it says that 7 defects are open

Scenario: A filter that matches nothing
  Given no open defect is suitable for helpers
  When a team member filters the open defects by suitable for helpers
  Then no defect is listed
  And it says that no open defect is suitable for helpers
  And going back to all open defects is offered

Scenario: Resolved defects are not listed
  Given the defect "Coin door jammed" was resolved
  When a team member opens the open defects list
  Then "Coin door jammed" is not listed

## Out of Scope
- Claim, hold and work log columns and filters (ST-024, ST-025, ST-029)
- Linking itself and the number of linked problem reports in the list (ST-022)
- Photos (ST-016)

## Open Questions
- none

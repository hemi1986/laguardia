---
id: ST-021
title: Open defects list and defect details
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-DefectRecorded]
depends_on: [ST-008, ST-018]
labels: [mvp, defect-work]
status: review
---

## Story
As a team member, I want to see all open defects, filter them and open a single defect, so that I know what needs to be done and can pick something to work on.

## Context
Read model `RM-OpenDefects`: museum number, machine model title, title, priority, suitable for helpers, claimed by, on hold with reason, number of linked problem reports, open since, last work log entry. Filterable by machine, priority, suitable for helpers, claimed by me, on hold.
This story delivers the list with the filters machine, priority and suitable for helpers, and the defect details (machine, title, priority, suitable for helpers, open since, originating problem report). Claim, hold and work log fields and their filters are added by ST-024, ST-025 and ST-029.
Also: the machine overview (ST-008) shows the number of open defects per machine.

## Acceptance Criteria

Scenario: Team member sees all open defects
  Given "LG-042" has the open defect "Left flipper weak" (high) recorded 5 days ago
  And "LG-007" has the open defect "Display flickers" (normal)
  When a team member opens the open defects list
  Then both defects are listed with museum number, machine model title, title, priority, suitable for helpers and open since
  And "Left flipper weak" comes before "Display flickers" because of its higher priority

Scenario: Filter by suitable for helpers
  Given "Rubber cracked" is suitable for helpers and "Display flickers" is not
  When a team member filters the open defects by suitable for helpers
  Then only "Rubber cracked" is listed

Scenario: Filter by machine
  When a team member filters the open defects by the machine "LG-042"
  Then only open defects of "LG-042" are listed

Scenario: Team member opens a defect
  When a team member opens the defect "Left flipper weak"
  Then its machine, title, priority, suitable-for-helpers mark, open since and the originating problem report with its description and photo are shown

Scenario: Machine overview shows the number of open defects
  Given "LG-042" has 2 open defects and 1 resolved defect
  When a team member opens the machine overview
  Then "LG-042" shows 2 open defects

Scenario: Resolved defects are not listed
  Given the defect "Coin door jammed" was resolved
  When a team member opens the open defects list
  Then "Coin door jammed" is not listed

## Out of Scope
- Claim, hold and work log columns and filters (ST-024, ST-025, ST-029)
- Number of linked problem reports (ST-022)

## Open Questions
- none

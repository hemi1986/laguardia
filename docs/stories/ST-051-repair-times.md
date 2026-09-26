---
id: ST-051
title: Repair times view
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-ProblemReportLinkedToDefect, EVT-WorkLogged, EVT-DefectResolved]
depends_on: [ST-024, ST-039]
labels: [dashboard]
status: review
---

## Story
As a technician, I want to see the median time from problem report to start of repair and to resolution per priority for the last 30 or 90 days, so that we can measure whether La Guardia actually speeds up repairs.

## Context
Read model `RM-RepairTimes` – measures the success criterion "time from report to start of repair and to resolution can be measured for every defect" (`docs/product/vision.md`). A simple view, no export.
- Report time of a defect = its earliest problem report (originating or linked).
- Start of repair = first work log entry (HS-9).
- Per priority; periods last 30 and last 90 days; also the number of defects.
- Defects closed on retirement do not count as resolved.
- After a reopen, the latest resolution counts for the time to resolved.
- Periods: the time to resolved uses the defects resolved in the period; the time to the first work log entry uses the defects whose first work log entry falls in the period.

## Acceptance Criteria

Scenario: Median times per priority
  Given in the last 30 days three high-priority defects were resolved, with 1, 2 and 6 days from their earliest problem report to their first work log entry and 3, 5 and 10 days to resolved
  When a technician opens the repair times for the last 30 days
  Then for priority high the view shows the median 2 days to the first work log entry, 5 days to resolved and 3 defects

Scenario: Earliest problem report counts
  Given the defect "Left flipper weak" was recorded from a problem report on 10 June
  And a problem report reported on 8 June was linked to it later
  When the repair times are calculated
  Then the report time of "Left flipper weak" is 8 June

Scenario: Switch to 90 days
  When a technician switches the repair times to the last 90 days
  Then the medians and numbers of defects are calculated over the last 90 days

Scenario: Defects closed on retirement are not counted as resolved
  Given the defect "Display dead" was closed on retirement
  When the repair times are calculated
  Then "Display dead" is not counted in the time to resolved

Scenario: Defects without work log entries
  Given the defect "Coin door jammed" was resolved without any work log entry
  When the repair times are calculated
  Then it counts for the time to resolved but not for the time to the first work log entry

Scenario: The latest resolution counts after a reopen
  Given the defect "Left flipper weak" was first reported on 1 June, resolved on 3 June, reopened on 5 June and resolved again on 9 June
  When the repair times are calculated
  Then its time to resolved is 8 days

Scenario: Period membership
  Given the defect "Display flickers" was reported 40 days ago, got its first work log entry 35 days ago and was resolved 10 days ago
  When a technician opens the repair times for the last 30 days
  Then "Display flickers" counts for the time to resolved
  But not for the time to the first work log entry

Scenario: Helpers cannot open the repair times
  Given a helper is logged in
  When the helper opens the repair times
  Then the repair times are not shown

## Out of Scope
- Export, charts, per-machine statistics

## Open Questions
- none

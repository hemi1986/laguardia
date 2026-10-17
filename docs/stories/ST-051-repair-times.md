---
id: ST-051
title: Repair times view
type: story
context: BC-Repair
priority: should
size: M
risk: medium
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-ProblemReportLinkedToDefect, EVT-WorkLogged, EVT-DefectResolved]
depends_on: [ST-022, ST-024, ST-028, ST-030, ST-039]
labels: [dashboard, ui]
status: review
---

## Story
As a technician, I want to see the median time from problem report to start of repair and to resolution per priority for the last 30 or 90 days, so that we can measure whether La Guardia actually speeds up repairs.

## Context
Read model `RM-RepairTimes` – measures the success criterion "time from report to start of repair and to resolution can be measured for every defect" (`docs/product/vision.md`). A simple view, no export. This story is not in the MVP, but it must be done before the trial is evaluated.
- Grouping uses the defect's current priority.
- Times are elapsed time (ST-003) shown in days with one decimal, in German number format (e.g. „2,5 Tage“, G13).
- The median of an even number of defects is the mean of the two middle values.
- The defect details show both times of that defect (to first work log entry, to resolved) once they exist.
- Report time of a defect = its earliest problem report (originating or linked).
- Start of repair = first work log entry (HS-9).
- Per priority; periods last 30 and last 90 days; also the number of defects.
- Defects closed on retirement do not count as resolved.
- After a reopen, the latest resolution counts for the time to resolved.
- Periods: the time to resolved uses the defects resolved in the period; the time to the first work log entry uses the defects whose first work log entry falls in the period.
- It depends on ST-030 and ST-039 because its scenarios need a reopened defect and a defect closed on retirement in the Given (lead dev, backlog grooming 2026-10-17).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G19, G20, G6, G7):
- The repair times are reached from a row in „Mehr“ in the team navigation, shown to technicians only (user, 2026-10-17, section 9 item 3; G19). [OPEN] The row's label and its place among the rows of „Mehr“ are not decided (recommendation: „Reparaturzeiten“, after „Teammitglieder“).
- The period is a choice of „Letzte 30 Tage“ / „Letzte 90 Tage“, in this order, „Letzte 30 Tage“ preselected (G20).
- Per priority (hoch, normal, niedrig) the view shows the two medians and the number of defects, each labelled in words (G6). A priority without defects in the period says so in words instead of showing numbers (G7).
- On the defect's page the times read „Bis zum ersten Arbeitsschritt: 1,5 Tage · Bis behoben: 4,0 Tage“; a time that does not exist yet is left out.

## Acceptance Criteria

Scenario: Median times per priority
  Given in the last 30 days three high-priority defects were resolved, with 1, 2 and 6 days from their earliest problem report to their first work log entry and 3, 5 and 10 days to resolved
  When a technician opens the repair times for the last 30 days
  Then for priority high the view shows the median 2.0 days to the first work log entry, 5.0 days to resolved and 3 defects

Scenario: Median of an even number of defects
  Given in the last 30 days two normal-priority defects were resolved 2 and 5 days after their earliest problem report
  When a technician opens the repair times for the last 30 days
  Then for priority normal the view shows the median 3.5 days to resolved

Scenario: Current priority counts
  Given the defect "Display flickers" was recorded with the priority normal, later set to high, and resolved in the last 30 days
  When a technician opens the repair times for the last 30 days
  Then "Display flickers" counts for priority high

Scenario: Both times in the defect details
  Given the defect "Left flipper weak" had its first work log entry 1.5 days and was resolved 4.0 days after its earliest problem report
  When a team member opens the defect "Left flipper weak"
  Then the defect details show 1.5 days to the first work log entry and 4.0 days to resolved

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

Scenario: A priority without defects in the period says so
  Given no low-priority defect was resolved or got its first work log entry in the last 30 days
  When a technician opens the repair times for the last 30 days
  Then for priority low the view says that there is no defect in this period
  And it shows no median for priority low

Scenario: Technicians reach the repair times from the navigation
  Given a technician is logged in
  When the technician opens "Mehr" in the team navigation
  Then the repair times can be opened from there
  And the last 30 days are preselected

Scenario: Helpers cannot open the repair times
  Given a helper is logged in
  When the helper opens the repair times
  Then the repair times are not shown
  And the team navigation does not offer them to the helper

## Out of Scope
- Export, charts, per-machine statistics

## Open Questions
- [OPEN] Label and place of the repair times' row in „Mehr“ (recommendation: „Reparaturzeiten“, after „Teammitglieder“) – `docs/stories/OPEN_QUESTIONS.md`.

---
id: ST-051
title: Repair times view
type: story
context: BC-Repair
priority: should
size: M
risk: medium
events: [EVT-ProblemReported, EVT-DefectRecorded, EVT-ProblemReportLinkedToDefect, EVT-WorkLogged, EVT-DefectResolved, EVT-DefectReopened, EVT-DefectClosedOnRetirement]
depends_on: [ST-022, ST-024, ST-027, ST-028, ST-030, ST-039]
labels: [dashboard, ui]
status: in-progress
---

## Story
As a technician, I want to see the median time from problem report to start of repair and to resolution per priority for the last 30 or 90 days, so that we can measure whether La Guardia actually speeds up repairs.

## Context
Read model `RM-RepairTimes` („Reparaturzeiten“) – measures the success criterion "time from report to start of repair and to resolution can be measured for every defect" (`docs/product/vision.md`). A simple view, no export. This story is not in the MVP, but it must be done before the trial is evaluated (`priority: must`, PO, story review 2026-10-17).
- Grouping uses the defect's current priority.
- Times are elapsed time (ST-003) shown in days with one decimal, in German number format (e.g. „2,5 Tage“, G13).
- The median of an even number of defects is the mean of the two middle values.
- The defect details show both times of that defect (to first work log entry, to resolved) once they exist.
- Report time of a defect = its earliest problem report (originating or linked).
- Start of repair = first work log entry (HS-9).
- Per priority; periods last 30 and last 90 days; also the number of defects.
- **The periods are elapsed time**: the last 30 days are the last 30 × 24 hours before the moment the view is opened (the last 90 days likewise), like the 7 days of ST-058 (lead dev, story review 2026-10-17).
- Defects closed on retirement do not count as resolved.
- After a reopen, the latest resolution counts for the time to resolved. **A reopened defect does not count for the time to resolved until it is resolved again**, and its page shows no time to resolved while it is open. Its first work log entry stays its first – a work log entry after the reopen does not change the time to the first work log entry (lead dev, UX, story review 2026-10-17).
- Periods: the time to resolved uses the defects resolved in the period; the time to the first work log entry uses the defects whose first work log entry falls in the period. So the two times of one priority may count different defects, and each carries its own number of defects.
- It depends on ST-030 and ST-039 because its scenarios need a reopened defect and a defect closed on retirement in the Given (lead dev, backlog grooming 2026-10-17); on ST-027 because a scenario changes the priority (lead dev, story review 2026-10-17).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; story review 2026-10-17, `docs/reviews/2026-10-17-story-review.md`; G19, G20, G6, G7, G13):
- The repair times are reached from a row in „Mehr“ in the team navigation, shown to technicians only (user, 2026-10-17, section 9 item 3; G19). The row is labelled „Reparaturzeiten“ and comes right after „Wartungsplan“ (user, backlog grooming 2026-10-17).
- The period is a choice of „Letzte 30 Tage“ / „Letzte 90 Tage“, in this order, „Letzte 30 Tage“ preselected (G20). A line under the choice says what is measured: both times run from a defect's earliest problem report – to its first work log entry, and to its resolution.
- **The word "Median" does not appear in the interface** (user, 2026-10-17, decision 3). One sentence explains the times: „Typische Dauer: Die Hälfte der Defekte ging schneller, die Hälfte langsamer.“
- Per priority (hoch, normal, niedrig) the view shows the two times, each labelled in words and each with its own number of defects (G6): „Bis zum ersten Arbeitsschritt: 2,0 Tage · 3 Defekte“, „Bis behoben: 5,0 Tage · 3 Defekte“.
- A time without any defect in the period says so in its place: „Bis behoben: kein Defekt in diesem Zeitraum“ (likewise „Bis zum ersten Arbeitsschritt: …“). A priority without any defect in the period shows only „Keine Defekte in diesem Zeitraum.“ instead of the two times (G7).
- On the defect's page the times read „Bis zum ersten Arbeitsschritt: 1,5 Tage · Bis behoben: 4,0 Tage“; a time that does not exist yet is left out.

## Acceptance Criteria

Scenario: Median times per priority
  Given in the last 30 days three high-priority defects were resolved, with 1, 2 and 6 days from their earliest problem report to their first work log entry and 3, 5 and 10 days to resolved
  When a technician opens the repair times for the last 30 days
  Then for priority high the view shows „Bis zum ersten Arbeitsschritt: 2,0 Tage · 3 Defekte“ and „Bis behoben: 5,0 Tage · 3 Defekte“

Scenario: Median of an even number of defects
  Given in the last 30 days two normal-priority defects were resolved 2 and 5 days after their earliest problem report
  When a technician opens the repair times for the last 30 days
  Then for priority normal the view shows „Bis behoben: 3,5 Tage · 2 Defekte“

Scenario: Current priority counts
  Given the defect "Display flickers" was recorded with the priority normal, later set to high, and resolved in the last 30 days
  When a technician opens the repair times for the last 30 days
  Then "Display flickers" counts for priority high

Scenario: Both times in the defect details
  Given the defect "Left flipper weak" had its first work log entry 1.5 days and was resolved 4.0 days after its earliest problem report
  When a team member opens the defect "Left flipper weak"
  Then the defect details show „Bis zum ersten Arbeitsschritt: 1,5 Tage · Bis behoben: 4,0 Tage“

Scenario: Earliest problem report counts
  Given the defect "Left flipper weak" was recorded from a problem report on 10 June at 09:00
  And a problem report reported on 8 June at 09:00 was linked to it later
  And its first work log entry was made on 11 June at 09:00
  When a team member opens the defect "Left flipper weak"
  Then the defect details show „Bis zum ersten Arbeitsschritt: 3,0 Tage“

Scenario: Switch to 90 days
  Given the high-priority defect "Display flickers" was resolved 60 days ago
  When a technician switches the repair times to the last 90 days
  Then "Display flickers" counts for the time to resolved of priority high
  But it does not count when the technician switches back to the last 30 days

Scenario: The period is counted in elapsed hours
  Given the low-priority defect "Coin door jammed" was resolved 30 days minus one hour ago
  And the low-priority defect "Lamp out" was resolved 30 days plus one hour ago
  When a technician opens the repair times for the last 30 days
  Then "Coin door jammed" counts for the time to resolved of priority low
  But "Lamp out" does not

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
  Then its time to resolved is 8.0 days

Scenario: A reopened defect does not count for the time to resolved while it is open
  Given the defect "Left flipper weak" was resolved 10 days ago and reopened 5 days ago, and is open
  When a technician opens the repair times for the last 30 days
  Then "Left flipper weak" is not counted in the time to resolved
  And its page shows no time to resolved

Scenario: The first work log entry stays the first after a reopen
  Given the defect "Left flipper weak" was first reported on 1 June, got its first work log entry on 2 June, was resolved on 3 June and reopened on 5 June
  And a work log entry was made on 6 June
  When a team member opens the defect "Left flipper weak"
  Then the defect details show „Bis zum ersten Arbeitsschritt: 1,0 Tage“

Scenario: Period membership
  Given the defect "Display flickers" was reported 40 days ago, got its first work log entry 35 days ago and was resolved 10 days ago
  When a technician opens the repair times for the last 30 days
  Then "Display flickers" counts for the time to resolved
  But not for the time to the first work log entry

Scenario: A time without defects in the period says so
  Given in the last 30 days one normal-priority defect got its first work log entry and no normal-priority defect was resolved
  When a technician opens the repair times for the last 30 days
  Then for priority normal the view shows the time to the first work log entry with 1 defect
  And it says „Bis behoben: kein Defekt in diesem Zeitraum“

Scenario: A priority without defects in the period says so
  Given no low-priority defect was resolved or got its first work log entry in the last 30 days
  When a technician opens the repair times for the last 30 days
  Then for priority low the view says „Keine Defekte in diesem Zeitraum.“
  And it shows no time for priority low

Scenario: The view explains the times without the word median
  When a technician opens the repair times
  Then the view says what is measured, from the earliest problem report to the first work log entry and to resolved
  And it explains the times with „Typische Dauer: Die Hälfte der Defekte ging schneller, die Hälfte langsamer.“
  And the word "Median" is not shown

Scenario: Technicians reach the repair times from the navigation
  Given a technician is logged in
  When the technician opens "Mehr" in the team navigation
  Then „Reparaturzeiten“ is offered right after „Wartungsplan“
  And opening it shows the repair times with the last 30 days preselected

Scenario: Helpers cannot open the repair times
  Given a helper is logged in
  When the helper opens the repair times
  Then the repair times are not shown
  And the team navigation does not offer them to the helper

## Out of Scope
- Export, charts, per-machine statistics

## Open Questions
- none – label and place of the row in „Mehr“ were decided (user, backlog grooming 2026-10-17).

## Notes
- Glossary: „Reparaturzeiten“ and the two durations (to the first work log entry, to resolved) go into `CONTEXT.md` before this story is built (user, story review 2026-10-17, decision 3) – done by the domain-architect in parallel with this revision.
- `RM-RepairTimes` in `events.yaml` is also fed by `EVT-DefectReopened` and `EVT-DefectClosedOnRetirement` (story review 2026-10-17, decision 3); both are linked here.
- Story review 2026-10-17: the product owner raised this to `must` (vision success criterion 2); set back to `should` the same day because `must` pulled ST-039 (which needs an ADR first) ahead of the defect lifecycle in the generated backlog – the user decided that priority does not set the order. The value stays: it must be done before the trial is evaluated.

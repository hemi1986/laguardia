---
id: ST-017
title: Triage list of untriaged problem reports
type: story
context: BC-Repair
priority: must
size: S
risk: low
events: [EVT-ProblemReported]
depends_on: [ST-013, ST-015]
labels: [mvp, triage, ui]
status: in-progress
---

## Story
As a technician, I want to see all untriaged problem reports with their machine, description and reporter, so that I can triage every problem report and none gets lost.

## Context
Read model `RM-TriageList`; manual routine `POL-TriageProblemReports`. Fields: museum number, machine model title, description, photo, reporter (visitor or team member name), reported at, waiting longer than 3 days (HS-2), open and recently resolved defects of the machine (for linking).
- "Waiting longer than 3 days" means more than 72 hours since the problem report was reported (time convention, ST-003).
- Helpers see the triage list too, but may only resolve problems on the spot there (ST-019); the other triage outcomes are technician-only.
- Showing photos is part of ST-016. Triage actions: ST-018 (record defect), ST-019 (resolve on the spot), ST-020 (dismiss), ST-022 (link).
- The list entry shows the machine, the description, the reporter and how long the problem report has been waiting, plus one way to open it; the four triage outcomes live on that problem report's own page (G5).
- "Empty" is the good state here, and it still says so: the empty case and how many problem reports wait are both said in words (G7, G6).
- The long wait is said in words next to the entry, not only by a colour (G6a).
- The scenario "Report text is never interpreted" moved here from ST-013 (user, 2026-10-03): the triage list is the first page that shows problem report texts.

Decided in the test plan (user, 2026-10-03, during `/implement ST-017`):
- ST-017 builds the problem report's own page (machine, description, reporter, waiting time) and owns it (G18). Each triage story adds its outcome there – ST-018 record defect, ST-019 resolve on the spot, ST-020 dismiss, ST-022 link; no dead buttons before.
- The triage columns of the data model's Triage value object (outcome, triaged by, triaged at) are added now as foundation just in time, so "untriaged" means something. The triage list and the visitor count read only untriaged problem reports; ST-018 ff. set them.
- Helpers see "Sichtung" in the team navigation too (G19, changed by the user the same day).

## Acceptance Criteria

Scenario: Technician sees untriaged problem reports
  Given a visitor reported "Ball stuck behind the left ramp" for "LG-042" at 14:05
  And the helper Anna reported "Rubber cracked" for "LG-007" at 15:10
  When a technician opens the triage list
  Then both problem reports are listed with museum number, machine model title, description, reporter ("visitor" or "Anna") and time reported
  And the oldest problem report comes first

Scenario: Problem reports waiting longer than 72 hours are highlighted
  Given a problem report for "LG-042" was reported 73 hours ago and is untriaged
  And a problem report for "LG-007" was reported 71 hours ago and is untriaged
  When a technician opens the triage list
  Then the problem report for "LG-042" is highlighted as waiting longer than 3 days
  And the one for "LG-007" is not

Scenario: Helpers see the triage list without technician actions
  Given the helper Anna is logged in
  And a problem report for "LG-042" is untriaged
  When Anna opens the triage list
  Then she sees the problem report
  But recording a defect, linking and dismissing are not offered to her

Scenario: Triaged problem reports leave the list
  Given a problem report for "LG-042" has been triaged
  When a technician opens the triage list
  Then that problem report is not listed

Scenario: Nothing waits for triage
  Given no problem report is untriaged
  When a technician opens the triage list
  Then it says that nothing waits for triage
  And no problem report is listed

Scenario: How many problem reports wait
  Given 12 problem reports are untriaged
  When a technician opens the triage list
  Then it says that 12 problem reports wait for triage

Scenario: The long wait is said in words
  Given a problem report for "LG-042" was reported 73 hours ago and is untriaged
  When a technician opens the triage list
  Then that problem report says in words how long it has been waiting

Scenario: Triaging happens on the problem report's own page
  Given a problem report for "LG-042" is untriaged
  When a technician opens that problem report from the triage list
  Then its machine, description, reporter and waiting time are shown

Scenario: Report text is never interpreted
  Given a visitor reported a problem with the description "<script>alert(1)</script>"
  When a technician opens the triage list
  Then the description is shown as that literal text

Scenario: Visitors cannot open the triage list
  Given nobody is logged in
  When the triage list is opened
  Then the login is requested first

## Out of Scope
- The triage actions themselves (ST-018, ST-019, ST-020, ST-022)
- Photos (ST-016)
- Open and recently resolved defects of the machine shown for linking (ST-022, ST-053)
- Highlighting on the technician dashboard (ST-048)

## Open Questions
- none

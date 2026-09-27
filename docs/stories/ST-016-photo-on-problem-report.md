---
id: ST-016
title: Add a photo to a problem report and show it to the team
type: story
context: BC-Repair
priority: must
size: M
risk: high
events: [EVT-ProblemReported]
depends_on: [ST-002, ST-015, ST-017, ST-021, ST-064, ST-072]
labels: [mvp, visitor, triage]
status: ready
---

## Story
As a visitor, I want to add a photo from my phone camera to my problem report, so that the technician understands the problem without having to reproduce it.

## Context
`EVT-ProblemReported` has an optional photo; `CMD-ReportProblem`: photo is optional. Applies to visitors and team members alike.
- The photo belongs to the problem report; it is not a file (`CONTEXT.md`).
- Photo handling from spike ST-002: rotated, downscaled, re-encoded, EXIF (incl. GPS location) removed, image type as documented by ST-002. Size limit (user decision 2026-09-27): photos up to 20 MB are accepted; they are stored downscaled to a longest edge of 2048 px and at most 1 MB. Spike ST-002 may correct these numbers.
- Visitor photos may show people and are personal data (`docs/adr/0005-hosting-vercel.md`); only team members can see them. Visitors never see photos of problem reports (HS-1).
- One photo per problem report ("Photo (optional)").
- This story owns showing the photo to team members: in the triage list (ST-017) and in the defect details with the originating and linked problem reports (ST-021).
- The visitor report form shows a short privacy notice about the photo in German and English, linking to the full privacy notice (ST-064); the notice text is provided by the museum.
- A photo is kept as long as its problem report; it is only removed when the problem report is dismissed as spam (ST-020).
- If sending the photo fails, the typed description is kept so the visitor does not have to type it again.

## Acceptance Criteria

Scenario: Visitor adds a photo taken with the phone camera
  Given a visitor is reporting a problem for "LG-042"
  When the visitor takes a photo with the phone camera and submits the problem report
  Then the problem report has the photo, downscaled to a longest edge of at most 2048 px and at most 1 MB
  And the stored photo contains no location or other EXIF metadata

Scenario: Team member adds a photo
  Given a helper is reporting a problem for "LG-042" from its machine record
  When the helper chooses an existing photo from the phone and submits the problem report
  Then the problem report has the photo

Scenario: Photo is optional
  When a visitor submits a problem report with a description and without a photo
  Then the problem report is recorded without a photo

Scenario: Non-image content is rejected
  When a visitor submits a problem report with content that is not an image as photo
  Then the problem report is rejected
  And the visitor is asked to choose a photo or leave it out

Scenario: Photo above the size limit is rejected
  When a visitor submits a photo larger than 20 MB
  Then the problem report is rejected with the maximum size of 20 MB shown

Scenario: Failed photo keeps the description
  Given a visitor has typed the description "Right flipper dead"
  When sending the photo fails
  Then the form still contains "Right flipper dead"
  And the visitor can try again or submit without a photo

Scenario: Technician sees the photo in the triage list
  Given an untriaged problem report for "LG-042" has a photo
  When a technician opens the triage list
  Then the photo is shown with the problem report

Scenario: Photo is shown in the defect details
  Given a defect was recorded from a problem report with a photo
  When a team member opens the defect
  Then the photo of its originating problem report is shown

Scenario: Visitor sees the privacy notice
  Given a visitor with an English browser is reporting a problem for "LG-042"
  When the visitor is about to add a photo
  Then the museum's privacy notice about the photo is shown in English

Scenario: Photo is kept with its problem report
  Given a problem report with a photo was triaged as defect recorded
  When a team member opens the defect's originating problem report a year later
  Then the photo is still shown

Scenario: Only team members can see the photo
  Given a problem report for "LG-042" has a photo
  When a visitor opens the visitor machine page of "LG-042"
  Then the photo is not shown and cannot be opened

## Out of Scope
- Several photos per problem report
- Photos on work log entries (ST-032)

## Open Questions
- none

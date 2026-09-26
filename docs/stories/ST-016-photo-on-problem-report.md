---
id: ST-016
title: Add a photo to a problem report
type: story
context: BC-Repair
priority: should
size: null
risk: null
events: [EVT-ProblemReported]
depends_on: [ST-002, ST-014, ST-015]
labels: [mvp, visitor, triage]
status: review
---

## Story
As a visitor, I want to add a photo from my phone camera to my problem report, so that the technician understands the problem without having to reproduce it.

## Context
`EVT-ProblemReported` has an optional photo; `CMD-ReportProblem`: photo is optional. Applies to visitors and team members alike.
- The photo belongs to the problem report; it is not a file (`CONTEXT.md`).
- Photo handling from spike ST-002: downscaled, re-encoded, EXIF (incl. GPS location) removed, type and size limits (also spam protection, `docs/adr/0001-tech-stack.md`).
- Visitor photos may show people and are personal data (`docs/adr/0005-hosting-vercel.md`); only team members can see them. Visitors never see photos of problem reports (HS-1).
- One photo per problem report ("Photo (optional)").
- The visitor report form shows a short privacy notice about the photo in German and English; the notice text is provided by the museum.
- A photo is kept as long as its problem report; it is only removed when the problem report is dismissed as spam (ST-020).

## Acceptance Criteria

Scenario: Visitor adds a photo taken with the phone camera
  Given a visitor is reporting a problem for "LG-042"
  When the visitor takes a photo with the phone camera and submits the problem report
  Then the problem report has the photo, downscaled to the limits decided in ST-002
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

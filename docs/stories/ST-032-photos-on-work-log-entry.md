---
id: ST-032
title: Add photos to a work log entry
type: story
context: BC-Repair
priority: should
size: S
risk: low
events: [EVT-WorkLogged]
depends_on: [ST-002, ST-024, ST-016]
labels: [defect-work, ui]
status: ready
---

## Story
As a technician, I want to add photos (e.g. before and after) to a work log entry, so that the repair history shows how the machine looked and how the fault was fixed.

## Context
`EVT-WorkLogged` has optional photos (HS-5). Photos belong to the work log entry; they are not files (`CONTEXT.md`). Photo handling from spike ST-002: rotated, downscaled, re-encoded, no EXIF/location metadata, only visible to team members.
- At most 5 photos per work log entry.
- Work log entries are only added, never changed – so photos cannot be added to or removed from an existing entry.

## Acceptance Criteria

Scenario: Team member logs work with photos
  Given the open defect "Left flipper weak"
  When a team member logs work with "Replaced coil stop" and two photos taken with the phone camera
  Then the work log entry has both photos, downscaled and without location metadata

Scenario: At most 5 photos
  When a team member logs work with 6 photos
  Then the work log entry is rejected with the maximum of 5 photos shown

Scenario: Photos are shown with the work log entry
  Given a work log entry of "Left flipper weak" has two photos
  When a team member opens the defect "Left flipper weak"
  Then the work log entry shows both photos

Scenario: Non-image content is rejected
  When a team member logs work with content that is not an image as photo
  Then the work log entry is rejected
  And nothing is added

Scenario: Photos cannot be added to an existing entry
  Given a work log entry without photos exists
  When a team member tries to add a photo to that entry
  Then the entry stays unchanged

## Out of Scope
- Photos as files of a machine (ST-054)

## Open Questions
- none

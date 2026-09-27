---
id: ST-054
title: Attach a camera photo as a file of a machine
type: story
context: BC-Collection
priority: must
size: S
risk: low
events: [EVT-FileAttached]
depends_on: [ST-002, ST-037, ST-016]
labels: [mvp, files]
status: ready
---

## Story
As a team member, I want to take a photo with my phone camera and attach it as a file with the file category *Photo* to a machine or machine model, so that details like wiring or the original state are documented at the machine.

## Context
Second part of the split of ST-037 (story review 2026-09-26). All rules of `CMD-AttachFile` (ST-037) apply: title and file category required, team members only, attached to exactly one machine or machine model.
- The photo goes through the photo handling of ST-002: rotated, downscaled, re-encoded, no EXIF/location metadata.
- A photo attached this way is a file (file category *Photo*), unlike photos of problem reports and work log entries (`CONTEXT.md`).

## Acceptance Criteria

Scenario: Team member attaches a camera photo to a machine
  When a team member takes a photo of the backbox wiring of "LG-042" and attaches it with the title "Backbox wiring 2026" and the file category Photo
  Then only the machine record of "LG-042" shows it under Photo
  And the stored photo contains no location metadata

Scenario: Photo of a machine model
  When a team member attaches a camera photo "Original playfield" with the file category Photo to the machine model "Medieval Madness"
  Then every machine of that model shows it under Photo

Scenario: Title is required
  When a team member attaches a camera photo without a title
  Then the file is not attached

Scenario: Non-image content is rejected
  When a team member attaches content that is not an image through the camera photo option
  Then the file is not attached

## Out of Scope
- Several photos in one step

## Open Questions
- none

---
id: ST-032
title: Add photos to a work log entry
type: story
context: BC-Repair
priority: could
size: S
risk: low
events: [EVT-WorkLogged]
depends_on: [ST-002, ST-024, ST-016]
labels: [defect-work, ui]
status: done
---

## Story
As a technician, I want to add photos (e.g. before and after) to a work log entry, so that the repair history shows how the machine looked and how the fault was fixed.

## Context
`EVT-WorkLogged` has optional photos (HS-5). Photos belong to the work log entry; they are not files (`CONTEXT.md`). Photo handling from spike ST-002: rotated, downscaled, re-encoded, no EXIF/location metadata, only visible to team members.
- At most 5 photos per work log entry.
- Work log entries are only added, never changed – so photos cannot be added to or removed from an existing entry.

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G8, G8a):
- After any rejection of a form that had photos attached, the rejection text is followed by „Die Fotos müssen erneut ausgewählt werden.“ (G8a), e.g. „Bitte kurz beschreiben, was gemacht wurde. Die Fotos müssen erneut ausgewählt werden.“ The chooser shows itself as empty. Not after a rejection of the photos themselves (too many, not an image, above 20 MB) – those texts already say what to do (G8a, user 2026-10-10).
- The conflict text of the work log form (ST-024: the defect was changed meanwhile, the input is still there) names the photos too: the typed text is still there, but the photos must be chosen again.
- The photos of a work log entry are shown under it on the defect's page **and on the repair history's own page** (`/team/machines/<museum number>/reparaturhistorie`, ST-033) (user, 2026-10-17, section 9 item 3).

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

Scenario: Photos are shown on the repair history
  Given a work log entry of "Left flipper weak" of "LG-042" has two photos
  When a team member opens the repair history of "LG-042"
  Then both photos are shown under that work log entry

Scenario: A rejection says the photos must be chosen again
  When a team member logs work with two photos but without saying what was done
  Then the work log entry is rejected
  And the rejection says "Bitte kurz beschreiben, was gemacht wurde. Die Fotos müssen erneut ausgewählt werden."
  And no photo is shown as still attached

Scenario: The conflict text names the photos
  Given a team member is logging work with two photos on "Left flipper weak"
  And someone else changed "Left flipper weak" meanwhile
  When the team member sends the work log entry
  Then it is rejected
  And the rejection says that the typed text is still there and the photos must be chosen again

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

---
id: ST-037
title: Attach files to a machine or machine model and find them by file category
type: story
context: BC-Collection
priority: should
size: null
risk: null
events: [EVT-FileAttached]
depends_on: [ST-002, ST-009]
labels: [mvp, files]
status: review
---

## Story
As a technician, I want manuals, schematics, photos and other files attached to the machine model or the single machine and grouped by file category on the machine record, so that I have them on my phone when I stand at the machine.

## Context
Command `CMD-AttachFile` (any team member). Rules and invariants (`AGG-File`):
- A file belongs to exactly one machine or one machine model, which never changes.
- A title and exactly one file category (*Manual*, *Schematic*, *Photo*, *Other*) are required.
- A file is at most 100 MB; any format is allowed (PDF and images expected). The limit is confirmed against the storage plan found in ST-001.
- Files of a machine model are shown on the machine record of every machine of that model (`RM-MachineRecord`: files of the machine and its machine model by file category).
Technical: large files (scanned manuals of tens of MB) are uploaded directly from the browser to object storage (ST-001); photos use the photo handling of ST-002. File metadata stays in PostgreSQL (`docs/adr/0005-hosting-vercel.md`).
UI wording (de): Datei, Dateikategorie (Handbuch / Schaltplan / Foto / Sonstiges).

## Acceptance Criteria

Scenario: Helper attaches a manual to a machine model
  Given the machines "LG-042" and "LG-043" are of the machine model "Medieval Madness"
  When the helper Anna attaches the PDF "MM Operations Manual" with the file category Manual to the machine model "Medieval Madness"
  Then the machine records of "LG-042" and "LG-043" both show "MM Operations Manual" under Manual

Scenario: Team member attaches a photo to a single machine
  When a team member takes a photo of the backbox wiring of "LG-042" and attaches it with the title "Backbox wiring 2026" and the file category Photo
  Then only the machine record of "LG-042" shows it under Photo

Scenario: Large manual is uploaded
  Given a scanned schematic PDF of 60 MB
  When a technician attaches it to the machine model "Medieval Madness" with the file category Schematic
  Then the file is attached and can be opened from the machine record

Scenario: Files above 100 MB are rejected
  Given a scanned manual PDF of 120 MB
  When a team member tries to attach it
  Then the file is not attached
  And the team member is told that files can be at most 100 MB

Scenario: File category is required
  When a team member attaches a file without a file category
  Then the file is not attached

Scenario: Title is required
  When a team member attaches a file without a title
  Then the file is not attached

## Out of Scope
- Removing files (ST-038)
- Photos of problem reports and work log entries – they are not files (ST-016, ST-032)

## Open Questions
- none

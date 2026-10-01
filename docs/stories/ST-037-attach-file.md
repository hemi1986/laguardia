---
id: ST-037
title: Attach files to a machine or machine model and find them by file category
type: story
context: BC-Collection
priority: should
size: M
risk: medium
events: [EVT-FileAttached]
depends_on: [ST-001, ST-009, ST-016]
labels: [mvp, files, ui]
status: ready
---

## Story
As a technician, I want manuals, schematics and other files attached to the machine model or the single machine and grouped by file category on the machine record, so that I have them on my phone when I stand at the machine.

## Context
Command `CMD-AttachFile` (any team member). Rules and invariants (`AGG-File`):
- A file belongs to exactly one machine or one machine model, which never changes.
- A title and exactly one file category (*Manual*, *Schematic*, *Photo*, *Other*) are required.
- A file is at most 100 MB; any format is allowed (PDF and images expected). The limit is confirmed against the storage plan found in ST-001.
- Files are visible to team members only, like photos (rule on `CMD-AttachFile`, decision D10); visitors can neither see nor open them.
- PDFs and images can be opened in the browser; every other format is always offered as a download, never opened in the browser.
- Files of a machine model are shown on the machine record of every machine of that model (`RM-MachineRecord`: files of the machine and its machine model by file category).
Technical: large files are uploaded directly from the browser to private object storage (ST-001). Content that was uploaded but never attached (e.g. the form was abandoned) is detected and removed; the mechanism works without a scheduler (`docs/adr/0002-modular-monolith-state-based-persistence.md`) and is documented. File metadata stays in PostgreSQL (`docs/adr/0005-hosting-vercel.md`). Taking a photo with the camera as a file follows in ST-054.
UI wording (de): Datei, Dateikategorie (Handbuch / Schaltplan / Foto / Sonstiges).

## Acceptance Criteria

Scenario: Helper attaches a manual to a machine model
  Given the machines "LG-042" and "LG-043" are of the machine model "Medieval Madness"
  When the helper Anna attaches the PDF "MM Operations Manual" with the file category Manual to the machine model "Medieval Madness"
  Then the machine records of "LG-042" and "LG-043" both show "MM Operations Manual" under Manual

Scenario: Team member attaches a file to a single machine
  When a team member attaches the PDF "LG-042 wiring notes" with the file category Other to the machine "LG-042"
  Then only the machine record of "LG-042" shows it under Other

Scenario: Large manual is uploaded
  Given a scanned schematic PDF of 60 MB
  When a technician attaches it to the machine model "Medieval Madness" with the file category Schematic
  Then the file is attached and can be opened from the machine record

Scenario: Files above 100 MB are rejected
  Given a scanned manual PDF of 120 MB
  When a team member tries to attach it
  Then the file is not attached
  And the team member is told that files can be at most 100 MB

Scenario: Other formats are only downloaded
  Given the machine model "Medieval Madness" has the file "MM sound ROM image" in a format that is neither PDF nor image
  When a team member opens it
  Then it is downloaded, not opened in the browser

Scenario: Files are team-only
  Given the machine model "Medieval Madness" has the file "MM Operations Manual"
  When someone who is not logged in tries to open that file's address
  Then the file is not delivered

Scenario: File category is required
  When a team member attaches a file without a file category
  Then the file is not attached

Scenario: Title is required
  When a team member attaches a file without a title
  Then the file is not attached

Scenario: Abandoned uploads do not stay
  Given a team member uploaded a PDF but closed the page before attaching it
  When the documented cleanup has run
  Then the uploaded content is no longer in object storage

## Out of Scope
- Taking a photo with the camera as a file (ST-054)
- Removing files (ST-038)
- Photos of problem reports and work log entries – they are not files (ST-016, ST-032)

## Open Questions
- none

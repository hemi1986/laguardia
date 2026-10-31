---
id: ST-037
title: Attach files to a machine or machine model and find them by file category
type: story
context: BC-Collection
priority: should
size: L
risk: high
events: [EVT-FileAttached]
depends_on: [ST-001, ST-009, ST-016, ST-085]
labels: [mvp, files, ui]
status: done
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
Technical: **split in the backlog grooming of 2026-10-17** (user, section 9 item 2). The direct private large-file upload from the browser to object storage, and what happens to content that was uploaded but never attached, are the tech task **ST-085**, which this story builds on. File metadata stays in PostgreSQL (`docs/adr/0005-hosting-vercel.md`). Taking a photo with the camera as a file follows in ST-054.
UI wording (de): Datei, Dateikategorie (Handbuch / Schaltplan / Foto / Sonstiges).

Interface (backlog grooming 2026-10-17, `docs/reviews/2026-10-17-backlog-grooming.md`; G18, G20, G8a, G7):
- The files go into section 8 of the machine record (owner ST-009, G18): the files of the machine and of its machine model, grouped by file category in glossary order (Handbuch, Schaltplan, Foto, Sonstiges).
- Section 8 offers „Datei anhängen“, which leads to the form page. It is also the entry for a machine model's files: the choice „Anhängen an“ offers „nur LG-042“ / „alle Geräte des Modells Medieval Madness“, none preselected (G20).
- The choice „Dateikategorie“ offers „Handbuch“, „Schaltplan“, „Foto“, „Sonstiges“, in this order, none preselected (G20).
- Empty section 8: „Noch keine Dateien zu diesem Gerät oder seinem Modell.“, with „Datei anhängen“ below it (G7).
- A rejection of the form names the reason and says what happened to the chosen file (G8a): either „Bitte einen Titel angeben. Die Datei muss erneut ausgewählt werden.“ and the chooser shows itself as empty, or – if the implementation keeps the already uploaded content for the next attempt – that the file is still attached. Not after a rejection of the file itself (above 100 MB): that text already says what to do.
- After attaching, the team member lands on the machine record with a confirmation naming the file.

## Acceptance Criteria

Scenario: Helper attaches a manual to a machine model
  Given the machines "LG-042" and "LG-043" are of the machine model "Medieval Madness"
  When the helper Anna attaches the PDF "MM Operations Manual" with the file category Manual to all machines of the model "Medieval Madness"
  Then the machine records of "LG-042" and "LG-043" both show "MM Operations Manual" under Manual

Scenario: Team member attaches a file to a single machine
  When a team member attaches the PDF "LG-042 wiring notes" with the file category Other to the machine "LG-042" only
  Then only the machine record of "LG-042" shows it under Other

Scenario: Large manual is attached
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

Scenario: Machine or machine model must be chosen
  When a team member attaches a file without choosing whether it belongs to the machine or to its machine model
  Then the file is not attached

Scenario: A rejection says what happened to the chosen file
  When a team member attaches a PDF without a title
  Then the rejection says "Bitte einen Titel angeben." followed by whether the file must be chosen again or is still attached
  And the chooser shows the file as attached only if it is still attached

Scenario: Attaching after the uploaded content is gone
  Given a team member chose the PDF "MM Operations Manual" for "LG-042" and it was uploaded
  And the uploaded content was cleaned up as an abandoned upload before the form was sent (ST-085)
  When the team member attaches it with the title "MM Operations Manual" and the file category Manual
  Then the file is not attached
  And the rejection says that the file must be chosen again
  And the title and the file category are still filled in, and the chooser shows itself as empty

Scenario: No files yet says so
  Given neither "LG-050" nor its machine model has a file
  When a team member opens the machine record of "LG-050"
  Then the files section says that there are no files for this machine or its machine model yet
  And attaching a file is offered there

## Out of Scope
- The direct upload to private object storage and abandoned uploads (ST-085)
- Taking a photo with the camera as a file (ST-054)
- Removing files (ST-038)
- Photos of problem reports and work log entries – they are not files (ST-016, ST-032)

## Open Questions
- none

## Notes
- Order (user, 2026-10-17, section 9 item 2): ST-085 and this story come **after the defect lifecycle** – ST-029, ST-030, ST-053, ST-031. That is a planning order, not a dependency; start them by name.
- The scenario "Attaching after the uploaded content is gone" was added from the story review of 2026-10-17 (`docs/reviews/2026-10-17-story-review.md`, ST-085 section): ST-085 cleans up abandoned uploads on a later request, so a form left open long enough can point at content that no longer exists.
- Size L and risk high were estimated by the lead dev before the split; the upload and the abandoned-upload decision moved to ST-085, so the lead dev re-estimates both in the story review.
- Hand-over from ST-085 (user, 2026-10-18; `docs/adr/0009-blob-content-consistency-and-abandoned-uploads.md`, `docs/engineering/conventions.md` section "Files uploaded from the browser"): ST-085 built an unlinked technicians' check page `/team/machines/<museum number>/upload-pruefen` (`src/app/(team)/team/machines/[museumNumber]/upload-pruefen/`, texts `uploadCheck` in `src/platform/messages/team.de.ts`) so the direct upload could be tested in the browser and from a phone before this story's form exists. This story's form replaces it: remove the page and its texts when the form is built.
- Attaching goes through the upload module's `withUploadedContent` (`src/upload/`); its own rejections are `content-gone` (scenario "Attaching after the uploaded content is gone") and `too-large`. Vercel Blob enforces the upload address's size limit only for an upload in one piece, not for an upload in parts (multipart, above 20 MB) – found in ST-085 – so the scenario "Files above 100 MB are rejected" is guaranteed by the size check when attaching; the browser-side `uploadFile` already refuses files above 100 MB before uploading.
- From ST-085's code review (`docs/reviews/ST-085-code-review.md`, #9): `withUploadedContent` deletes the uploaded content whenever the command is rejected – also for a missing title. Check the form's own input (title, file category, owner) before calling it, so a validation rejection keeps a 100 MB upload instead of deleting it.

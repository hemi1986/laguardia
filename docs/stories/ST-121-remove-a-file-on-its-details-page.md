---
id: ST-121
title: Remove a file on its details page
type: story
context: BC-Collection
priority: should
size: M
risk: medium
events: [EVT-FileRemoved, EVT-FileLeftAiIndex]
depends_on: [ST-114, ST-038]
labels: [feature:files, ui]
status: ready
---

## Story
As a technician, I want to remove a file on its details page, knowing everything it disappears from, so that I no longer remove a manual from one machine record without seeing where else it was used.

## Context
Feature `files` (`docs/domain/events.yaml` **CMD-RemoveFile**, **POL-RemovedFileLeavesAiIndex**, **AGG-File**, **RM-FileDetails**;
`docs/product/ux-guidelines.md` **G18** Files block, **G10**, **G10b**, **G3**, **G11**, **G17**, **G30**). Split off ST-114
(`docs/reviews/2026-11-02-story-review.md`, decision 2). Adds to the page ST-114 owns. Moves the removal of the done story
ST-038 to this page; it is not reopened.

**„Datei entfernen“** at the end of the file details, technicians only (G11), an ordinary secondary button (G30).

**Removal (CMD-RemoveFile; AGG-File: a removed file stays removed; POL-RemovedFileLeavesAiIndex):** „Datei entfernen“
leads to the question page of G10b, headed „Datei entfernen · MM Operations Manual“: „„MM Operations Manual“ entfernen? Die
Datei wird endgültig gelöscht. Sie verschwindet bei:“ with one line per machine and machine model in the wording of
„Angehängt an“. A file attached to nothing has only the first two sentences, without „Sie verschwindet bei:“. Buttons
„Endgültig entfernen“ (red, G30) and „Zurück“, which returns to the details page. The content is deleted after the commit,
the file leaves the AI index in the same step, also while AI is off. That the removal is rejected and asked again when
what the file is attached to changed meanwhile is ST-115's scenario, since nothing can change it before then.

**Landing (G3; user, 2026-11-02):** the removal lands where the way back of the file details leads (ST-114), with the
confirmation „„MM Operations Manual“ entfernt.“: the machine record, or „Einstellungen“. Without a known origin it lands on the
machine overview, until ST-117 makes that „Dateien“. The question page hands the origin on, restricted to the same closed
set; „Zurück“ returns to the file details with it.

**On the machine record (G18, G10b):** „Entfernen“ and its question page are gone. The former address of that page
(`datei-entfernen`) leads to the file details, so a bookmark or a page left open does not end in nothing.

## Acceptance Criteria

Scenario: The question names everything the file disappears from
  Given "MM Operations Manual" is attached to "LG-042" and to the machine model "Medieval Madness"
  When a technician taps „Datei entfernen“ on its file details
  Then the question names "MM Operations Manual", says that it is deleted for good and lists „LG-042 · Medieval Madness“ and „Alle Geräte des Modells Medieval Madness“
  And „Zurück“ returns to the file details and the file is still attached

Scenario: The question for a file attached to nothing names no list
  Given "Wiring notes" is attached to nothing
  When a technician taps „Datei entfernen“ on its file details
  Then the question says „„Wiring notes“ entfernen? Die Datei wird endgültig gelöscht.“ and nothing more

Scenario: A technician removes a file on its details page
  Given "MM Manual (wrong edition)" is attached to the machine model "Medieval Madness" and indexed for AI
  When a technician removes it on its file details and confirms with „Endgültig entfernen“
  Then no machine record shows it and its content is deleted from object storage
  And it is no longer in the AI index
  And it is recorded who removed it and when
  And the confirmation says „„MM Manual (wrong edition)“ entfernt.“

Scenario Outline: A removal lands where the person came from
  Given AI is on, and "Attract mode.mp4" is attached to "LG-042" and failed as format not indexed
  When a technician opens its file details from <where they are> and removes it
  Then the technician is back on <where they are> with the confirmation „„Attract mode.mp4“ entfernt.“

  Examples:
    | where they are                      |
    | the machine record of "LG-042"      |
    | the failed files on „Einstellungen“ |

Scenario: A removal without a known origin lands on the machine overview
  Given "MM Operations Manual" exists
  When a technician opens its file details through an address with a foreign web address as its origin and removes it
  Then the technician is on the machine overview with the confirmation „„MM Operations Manual“ entfernt.“

Scenario: The machine record no longer removes a file, and its former address leads to the details
  Given "MM Operations Manual" is on the machine record of "LG-042"
  When a technician opens the machine record and then the former address of its removal question
  Then the machine record offers „Details“ and no way to remove the file
  And the former address leads to the file details, and the file is still there

Scenario: A helper cannot remove a file
  Given a helper is logged in and "MM Operations Manual" exists
  When the helper opens its file details
  Then „Datei entfernen“ is not offered
  And the question page opened anyway is refused, and a removal sent anyway is rejected and the file is still there

Scenario: A file already removed cannot be removed again
  Given a technician sees the question to remove "Old manual", and another technician has removed it since
  When the technician confirms with „Endgültig entfernen“
  Then it is rejected with „Diese Datei wurde schon entfernt.“
  And nothing else changes

## Out of Scope
- Removing a file from the machine record or from the file overview
- Attaching and detaching (ST-115), and a removal asked before such a change (ST-115's scenario)
- Replacing a file's content (`docs/product/vision.md`)

## Open Questions
- none

## Notes
- ST-038 stays done and its scenarios stay true, on another path. Its tests keep their titles and move with the removal: `ST-038: Technician removes a file`, `ST-038: Removal needs a confirmation`. `src/app/(team)/team/machines/[museumNumber]/datei-entfernen/` goes as a page; only its address stays, leading to the file details.
- The command's existing `version` check stays: the question page posts the version it showed.
- ST-117 supersedes the scenario "A removal without a known origin lands on the machine overview", because the default then becomes „Dateien“; see the Notes there.
- The scenario "The question for a file attached to nothing names no list" sets that up in the test's data, since a file can be detached only with ST-115.

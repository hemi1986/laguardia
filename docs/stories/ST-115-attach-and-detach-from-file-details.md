---
id: ST-115
title: Attach a file to further machines and machine models, and detach it
type: story
context: BC-Collection
priority: should
size: L
risk: medium
events: [EVT-FileAttached, EVT-FileDetached]
depends_on: [ST-114, ST-094, ST-120, ST-121]
labels: [feature:files, ui]
status: in-progress
---

## Story
As a team member, I want to attach a file that already exists to further machines and machine models, and as a technician to detach it where it does not belong, so that one manual shows wherever it fits without uploading it twice.

## Context
Feature `files` (`docs/domain/events.yaml` **CMD-AttachFile**, **CMD-DetachFile**, **AGG-File**, **RM-AttachmentChoice**,
**RM-FileDetails**, **POL-AttachedFileIsIndexedForAi**; `docs/architecture/data-model.md`, *File*, *Retired machine*,
*Concurrency*; `docs/product/ux-guidelines.md` **G18** Files block, **G27**, **G10a**, **G11**, **G8**, **G3**). Adds to the
section „Angehängt an“ of the page ST-114 owns. The file details keep their origin (ST-114) through the form page.

**„Anhängen“ (CMD-AttachFile, any team member):** at the end of the section „Angehängt an“. It leads to a form page,
**„Anhängen · MM Operations Manual“** (G34), with „Zurück zur Datei“ (G17) and the submit button „Anhängen“ (G14).
- **Choice (RM-AttachmentChoice, G27, G20):** two parts, „Geräte“ and „Modelle“. In each, folding groups by machine
  category and technology in `CONTEXT.md`'s order (e.g. „Flipper · EM – 1 von 6 ausgewählt“), closed on opening, none
  ticked. A machine reads „LG-042 · Medieval Madness“, by museum number; a machine model reads „Medieval Madness“, by title.
  Retired machines are offered too, at the end of their group as „LG-041 · Ausgemustert“, as the file details show them
  (user, 2026-11-03). Only what the file is not attached to yet is offered. A machine of a machine model
  the file is attached to is still offered: it is a different thing to be attached to. Nothing to offer: „Es gibt
  nichts mehr, woran sich diese Datei anhängen lässt.“ (G7), with „Zurück zur Datei“ and no submit.
- **Landing (G3, G33):** the file details, with a confirmation of the resulting state: „„MM Operations Manual“ hängt jetzt
  an 2 Geräten und 1 Modell.“ („an 1 Gerät“, „an 3 Modellen“; only the parts there are). It lands the same when nothing
  changed.
- **Rejections (G8; the whole command, nothing attached; choices kept, groups with a choice open – G27):** nothing chosen,
  „Bitte mindestens ein Gerät oder Modell wählen.“. A retired machine is never refused and no retirement lock is taken
  (user, 2026-11-03); an unknown machine or machine model still rejects the whole command (CMD-AttachFile) – no command
  removes either, so the form itself does not meet it; it is a forged request, tested at the command only.
- **It is a set delta:** no version is sent. What is already attached is nothing to do – no event, no conflict.

**„Lösen“ (CMD-DetachFile, technicians only – helpers see no control, G11):** on each entry of „Angehängt an“, machines
and machine models, retired machines too. **One tap, no question (G10a):** back on the file details with „„MM Operations
Manual“ von LG-042 gelöst.“ / „… von Medieval Madness gelöst.“ Detaching what is already detached lands the same.
Nothing left: „Angehängt an“ says **„Nirgends angehängt“** (G7), the file stays a file, can be opened, stays in the AI index
and counts on the form „KI“. Removing it is a different action (ST-121). A retired machine is detached with one tap too
(user, 2026-11-02; G10a); attaching it again undoes it, since retired machines are offered (user, 2026-11-03).

**Removed file (AGG-File invariant):** it rejects both, „Diese Datei wurde schon entfernt.“

**Concurrency:** an attach or detach that really changed something raises the file's version, so a removal question that
listed something else is rejected and asked again with the current list (data model, G10b). ST-121 builds the question; the
scenario is here, because nothing can change the list before this story.

**The AI (context map, ADR 0018):** attaching and detaching are not composed with anything in AI assistance. They start no
indexing and cost nothing. What a new AI assessment can find is read when its writing begins (ST-120). Written AI
assessments and their references stay as they are; a reference still opens a file detached since (RM-DefectAiAssessments).

## Acceptance Criteria

Scenario: A helper attaches a file to several machines and machine models
  Given "MM Operations Manual" is attached to the machine model "Medieval Madness"
  And "LG-041" is retired
  When a helper chooses the machines "LG-050" and "LG-041" and the machine model "Eight Ball" under „Anhängen“ on its file details and sends the form
  Then the machine records of "LG-050", of "LG-041" and of every machine of "Eight Ball" show it, and those of "Medieval Madness" still do
  And „Angehängt an“ lists all four, "LG-041" as „LG-041 · Ausgemustert“
  And the helper is on the file details with the confirmation „„MM Operations Manual“ hängt jetzt an 2 Geräten und 2 Modellen.“

Scenario: Only what can be attached is offered
  Given "MM Operations Manual" is attached to "LG-042", and "LG-041" is retired
  And the active "LG-050" has the same machine category and technology as "LG-041"
  When a team member opens „Anhängen“ on its file details
  Then „Geräte“ and „Modelle“ are offered in closed groups by machine category and technology, with nothing ticked
  And "LG-042" is not offered, and "LG-050" is offered before „LG-041 · Ausgemustert“, which closes its group even though its museum number is lower

Scenario: Nothing left to offer says so
  Given "MM Operations Manual" is attached to every machine and every machine model
  When a team member opens „Anhängen“ on its file details
  Then the page says that there is nothing left to attach and has no submit button

Scenario: A rejected attach attaches nothing and keeps the choice
  Given "MM Operations Manual" is on the form „Anhängen“ with nothing chosen
  When the team member sends the form
  Then it is rejected with „Bitte mindestens ein Gerät oder Modell wählen.“ and nothing is attached

Scenario: Attaching what is already attached changes nothing
  Given a team member has the form „Anhängen“ of "MM Operations Manual" open with "LG-050" offered
  And another team member has attached it to "LG-050" since
  When the team member sends "LG-050"
  Then the team member lands on the file details with its confirmation, and nothing is rejected
  And the file is attached to "LG-050" once, and the journal holds one entry for "LG-050"

Scenario Outline: A technician detaches a file in one tap
  Given "MM Operations Manual" is attached to <what it is attached to> and to the machine "LG-050"
  When a technician taps „Lösen“ on <what it is attached to> without a question in between
  Then the technician is on the file details with the confirmation „„MM Operations Manual“ von <name> gelöst.“
  And the machine record of <where it no longer shows> no longer shows it, and that of "LG-050" still does

  Examples:
    | what it is attached to               | name              | where it no longer shows |
    | the machine "LG-042"                 | LG-042            | "LG-042"                 |
    | the machine model "Medieval Madness" | Medieval Madness  | "LG-043" of that model   |
    | the retired machine "LG-041"         | LG-041            | "LG-041"                 |

Scenario: A file detached from everything says so and stays a file
  Given AI is on and the indexed file "Wiring notes" is attached only to "LG-042"
  When a technician taps „Lösen“ on "LG-042"
  Then „Angehängt an“ says „Nirgends angehängt“
  And „Datei öffnen“ still opens it, and it still counts as indexed on the form „KI“

Scenario: Helpers cannot detach a file
  Given a helper is logged in and "Wiring notes" is attached to "LG-042"
  When the helper opens its file details
  Then „Lösen“ is not offered
  And a detach sent anyway is rejected and "Wiring notes" is still attached to "LG-042"

Scenario: A new AI assessment follows attach and detach, at no cost, and written ones stay
  Given AI is on, the indexed file "Wiring notes" is attached only to "LG-042", and a written AI assessment of a defect of "LG-042" has a reference to it
  When a technician detaches it from "LG-042" and a team member attaches it to "LG-050"
  Then a new AI assessment of a defect of "LG-042" does not find "Wiring notes", and one of a defect of "LG-050" does
  And the earlier AI assessment of "LG-042" still shows its reference to "Wiring notes", which still opens the file
  And neither step started a run or a request to OpenRouter, and the cost of indexing so far is unchanged

Scenario: A removed file can be neither attached nor detached
  Given a team member has the form „Anhängen“ of "Old manual" open and a technician has its file details open
  And "Old manual" has been removed since
  When they send the form and tap „Lösen“
  Then both are rejected with „Diese Datei wurde schon entfernt.“
  And "Old manual" shows nowhere

Scenario: A removal asked before a change asks again with the current list
  Given a technician sees the question to remove "MM Operations Manual", listing "LG-042"
  And a helper has attached it to "LG-050" since
  When the technician confirms with „Endgültig entfernen“
  Then the file is not removed
  And the question is shown again with the reason „Jemand hat das inzwischen geändert. Bitte die Seite neu laden und noch einmal versuchen.“, listing "LG-042" and "LG-050"

## Out of Scope
- Attaching while adding a file on the overview's form (ST-119); „Datei anhängen“ on the machine record stays (ST-037, ST-113)
- Attaching or detaching from a machine record or from the file overview
- Who attached or detached and when – journal only, no read model shows it (data model)
- Several files at once

## Open Questions
- none

## Notes
- From here on the rejected-removal scenario is reachable; the version check itself exists since ST-038, and the question page with its list since ST-121.
- Depends on ST-120 so that the first file attached to a second thing finds the machine columns of the AI index entry gone, and on ST-121 for the question in the rejected-removal scenario.
- Two requests sent at the very same moment are covered by the command's integration test; the scenario "Attaching what is already attached …" is the sequence a test controls.
- G27's grouped choice exists since ST-094; the choice here is one more use, with two parts, and ST-119 reuses it. Its folding and „Alle auswählen“ are tested where they were built.
- **Revised 2026-11-03 (requirements engineer, `OPEN_QUESTIONS.md` row "ST-113, ST-119"):** files may be attached to retired machines everywhere. The choice offers them, the rejection „LG-042 ist inzwischen ausgemustert …“ and its example row are gone, and „A rejected attach …“ is a plain scenario with its title kept. Back to `review` because the scenarios changed.

---
id: ST-119
title: Add a file from the file overview, attached to something or to nothing yet
type: story
context: BC-Collection
priority: should
size: L
risk: medium
events: [EVT-FileAdded, EVT-FileAttached, EVT-FileIndexedForAi]
depends_on: [ST-115, ST-116, ST-117]
labels: [feature:files, ui]
status: review
---

## Story
As a team member, I want to add a file from the file overview and attach it to any machines and machine models, or to nothing yet, and to see the name it came with, so that a manual gets into La Guardia before I know where it belongs.

## Context
Feature `files` (`docs/domain/events.yaml` **CMD-AddFile**, **EVT-FileAdded**, **POL-AttachedFileIsIndexedForAi**,
**RM-AttachmentChoice**, **RM-FileDetails**; `CONTEXT.md` *Original file name*; `docs/adr/0018-files-without-an-owner.md`;
`docs/product/ux-guidelines.md` **G2**, **G2a**, **G3**, **G7**, **G8**, **G8a**, **G13**, **G14**, **G20**, **G27**). Adds to the
pages ST-117 and ST-114 own. CMD-AddFile itself, on the machine record, and storing the original file name came with
ST-113 (reason there).

**One job:** adding one file. **Entry point:** „Datei hinzufügen“, directly under the heading of „Dateien“ (G2), leading to a
form page of its own (G2a) headed „Datei hinzufügen“, with „Zurück zu den Dateien“ (G17) and the submit button „Datei
hinzufügen“ (G14). In the empty overview: „Noch keine Dateien.“ with this button below it (G7), replacing ST-117's interim
sentence.

**Fields:**
- **„Datei“:** one file, at most 100 MB, any format, uploaded directly from the browser (ST-085).
- **„Titel“:** required. With JavaScript, choosing the file fills it with the file name without its last ending
  („medieval_manual-v2.pdf“ becomes „medieval_manual-v2“), but never over what the person typed. Without JavaScript it
  stays empty.
- **„Dateikategorie“:** required: „Handbuch“, „Schaltplan“, „Foto“, „Sonstiges“, in this order, none preselected (G20, as in
  ST-037).
- **„Anhängen an“, optional:** the choice of ST-115 (RM-AttachmentChoice, G27, two parts „Geräte“ and „Modelle“, retired
  machines at the end of their group as „LG-041 · Ausgemustert“ – user, 2026-11-03), with „Freiwillig. Eine Datei darf auch erst einmal nirgends angehängt sein.“

**Landing (G3):** the new file's details, with „„MM Operations Manual“ hinzugefügt.“. File and everything it is attached to
are stored together or not at all.

**Rejections (G8, G8a, G27):** no title, „Bitte einen Titel angeben.“; no file category, „Bitte eine Dateikategorie wählen.“.
A retired machine is never refused and no retirement lock is taken (user, 2026-11-03); an unknown machine or machine model
still rejects the whole command (CMD-AddFile) – no command removes either, so the form itself does not meet it. Each
rejection is followed by what happened to the chosen file, in ST-037's wording: „Die Datei muss erneut ausgewählt werden.“ with an
empty chooser, or „Die gewählte Datei ist noch angehängt: <name>“. Above 100 MB: „Dateien dürfen höchstens 100 MB groß
sein.“ alone (G8a's exception). A pending upload that is gone behaves as in ST-037.

**Original file name („Ursprünglicher Dateiname“):** the name on the team member's device; it can be searched (ST-118) and
never changes, also when the title is corrected (ST-116). It stays out of the journal. It shows in the head of the file
details and is **the name a saved or downloaded file gets**, for a file opened in the browser as well. A file from before the
feature (or from before ST-113) has none: no such line and the download name as today. The name comes from the browser, so
it never becomes a storage name and is made safe for the response header and the page.

**A file attached to nothing** is indexed and paid for like any other (POL-AttachedFileIsIndexedForAi, ADR 0018), but no AI
assessment finds it until it is attached. While AI is off it waits.

**The machine record stays:** „Datei anhängen“ and „Foto aufnehmen“ keep their forms and landing (ST-037, ST-054, ST-113), now
with the name visible on the file details. The title prefill is the overview's form only, so those forms stay as they are.

**The same content added twice** is not recognised and becomes two files (rule).

## Acceptance Criteria

Scenario: A helper adds the first file, attached to nothing
  Given no file exists
  When a helper taps „Datei hinzufügen“ in the empty overview and adds the PDF "medieval_manual-v2.pdf" with the title "MM Operations Manual" and the file category „Handbuch“, without choosing anything to attach it to
  Then the helper is on its file details with the confirmation „„MM Operations Manual“ hinzugefügt.“
  And „Angehängt an“ says „Nirgends angehängt“
  And „Dateien“ lists it

Scenario: Adding and attaching happen in one step
  Given the machine "LG-042" and the machine model "Eight Ball"
  When a team member adds a file with both chosen under „Anhängen an“
  Then the machine records of "LG-042" and of every machine of "Eight Ball" show it
  And the journal records the file added and attached to both in one step

Scenario: The title is filled in from the file name
  Given a team member's browser runs JavaScript and „Titel“ is empty
  When the team member chooses "medieval_manual-v2.pdf"
  Then „Titel“ holds "medieval_manual-v2" and can be changed
  And choosing a file after typing a title leaves the typed title
  And without JavaScript „Titel“ stays empty

Scenario: The original file name is kept and is the name of a download
  Given "medieval_manual-v2.pdf" was added with the title "MM Operations Manual", and "Early manual" was attached before the feature
  When a team member corrects the first file's title to "MM Manual" and opens both file details
  Then the first shows „Ursprünglicher Dateiname: medieval_manual-v2.pdf“, and the address that opens it carries that name as its download name
  And "Early manual" shows no original file name, and the address that opens it carries the download name it does today

Scenario: A file attached to nothing is indexed but not found by an AI assessment until attached
  Given AI is on
  When a team member adds the PDF "Unsorted manual" attached to nothing
  Then it is indexed for AI and counts on the form „KI“, with its cost in the cost of indexing so far
  And an AI assessment of a defect of "LG-042" does not find it
  And after attaching it to "LG-042" a new AI assessment does, without indexing it again

Scenario: Files above 100 MB are rejected
  Given a PDF of 120 MB
  When a team member tries to add it from the file overview
  Then no file is added and the form says „Dateien dürfen höchstens 100 MB groß sein.“, with no sentence about choosing it again
  And what was typed is still filled in

Scenario Outline: A rejected form says what happened to the chosen file
  Given a team member chose a PDF on „Datei hinzufügen“, with <what was filled in>
  When the team member sends the form
  Then it is rejected with „<reason>“ followed by what happened to the chosen file, and no file is added
  And what was filled in is still there, and the chooser shows the file only if it is still attached

  Examples:
    | what was filled in      | reason                               |
    | no title                | Bitte einen Titel angeben.           |
    | no file category        | Bitte eine Dateikategorie wählen.    |

Scenario: The machine record keeps adding through the same command
  When a team member adds the file "wiring.pdf" under „Datei anhängen“ on the machine record of "LG-042"
  Then the team member is back on the machine record with its confirmation
  And „Details“ leads to its file details, which show „Ursprünglicher Dateiname: wiring.pdf“ and „LG-042 · Medieval Madness“
  And „Dateien“ lists it

Scenario: Someone not logged in cannot add a file
  When someone not logged in opens the address of „Datei hinzufügen“, or sends its form
  Then the person is sent to the login and no file is added

## Out of Scope
- OCR, replacing content, spotting duplicates, several files at once, a preview (`docs/product/vision.md`)
- A title prefill on the machine record's forms
- Photos of problem reports and work log entries, the logo – they are not files (`CONTEXT.md`)

## Open Questions
- none

## Notes
- From ST-085's code review (`docs/reviews/ST-085-code-review.md`, #9, noted in ST-037): check the form's own input – title, file category, chosen things – before taking the uploaded content, which is deleted when a command rejects. The check that the chosen machines and machine models exist sits in the command (no retirement lock), so its rejection does delete the content: the sentence „… erneut ausgewählt werden“ is what the form says then.
- Definition of done: `/security-review` – a name typed by a browser reaches a response header and a page, hostile names included (quotes, CR/LF, path parts).
- **Done scenario this story supersedes** (`docs/engineering/conventions.md`, *A scenario of a done story that a later story supersedes*): ST-117 "No file yet says what to do" quotes the interim sentence this story replaces, so it goes into `docs/stories/superseded-scenarios.json` and its test goes with this story's change. The empty overview is covered by "A helper adds the first file, attached to nothing".
- Depends on ST-116 because the scenario "The original file name is kept …" corrects a title first.
- **Revised 2026-11-03 (requirements engineer, `OPEN_QUESTIONS.md` row "ST-113, ST-119"):** files may be attached to retired machines everywhere. „Anhängen an“ offers them, and the rejection „LG-042 ist inzwischen ausgemustert …“ and the scenario "A machine retired meanwhile rejects the whole form" are gone. Back to `review` because the scenarios changed.

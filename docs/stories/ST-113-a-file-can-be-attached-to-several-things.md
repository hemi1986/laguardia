---
id: ST-113
title: A file is attached to machines and machine models instead of belonging to one
type: story
context: BC-Collection
priority: should
size: L
risk: high
events: [EVT-FileAdded, EVT-FileAttached]
depends_on: [ST-037, ST-054, ST-085, ST-106]
labels: [feature:files, ui]
status: in-progress
---

## Story
As a team member, I want everything I see and do with files today to keep working when a file stops belonging to one machine or machine model, so that a manual that fits several things can then exist once, without anything getting lost.

## Context
Feature `files` (user, 2026-11-02; `docs/domain/events.yaml` **AGG-File**, **CMD-AddFile**,
**POL-AttachedFileIsIndexedForAi**, **RM-MachineRecord**, **FLOW-FileManagement**; `docs/architecture/data-model.md`,
section *File*; `docs/adr/0018-files-without-an-owner.md`). Foundation of the feature, written as a story because it has
observable behaviour. Changes the done stories ST-037, ST-054, ST-085 and ST-106; none is reopened. The AI's side of the
change is ST-120.

**Existing data (migration):** every existing file – removed ones included – gets its owner as the one thing it is
attached to; *Attached by* and *Attached at* become *Added by* and *Added at*; it has no original file name. A pending
upload loses its machine or machine model. The migration re-indexes nothing and calls no AI. The journal is not
rewritten: such a file has no EVT-FileAdded, and its EVT-FileAttached stands for adding it as well.

**The AI index entry keeps its copied machine columns for now,** filled from the file's one attachment, and the events of
the AI index keep naming a machine. That is safe because nothing can attach a second thing before ST-115, and ST-115
depends on ST-120, which removes both. So AI assessments and the form „KI“ read as they do today.

**Machine record (RM-MachineRecord):** it shows the same files as before – attached to the machine or to its machine
model – each once, also when attached to both. Such a file keeps the mark „Modell“, because every machine of the model
shows it.

**Adding on the machine record:** „Datei anhängen“ and „Foto aufnehmen“ (ST-037, ST-054) keep their forms, texts and
landing, but run CMD-AddFile: EVT-FileAdded and EVT-FileAttached together or not at all, the original file name stored
but not shown yet. Files and journal follow the new shape from here on. **EVT-FileAdded makes AI work, EVT-FileAttached no
longer does** (POL-AttachedFileIsIndexedForAi, ADR 0018): the run it starts finds the file as waiting, not through the
event's data. A pending upload belongs to the team member it was issued to; adding the file requires name, same team
member and an age below the fixed one (ADR 0018, ADR 0009).

## Acceptance Criteria

Scenario: Existing files stay where they were and nothing is indexed again
  Given the file "MM Operations Manual" belonged to the machine model "Medieval Madness" and is indexed for AI
  And "Wiring notes" belonged to the machine "LG-042", and "Old manual" was removed
  When the migration has run
  Then the machine records of "LG-042" and "LG-043", both of the machine model "Medieval Madness", show "MM Operations Manual"
  And only the machine record of "LG-042" shows "Wiring notes", and no machine record shows "Old manual"
  And "MM Operations Manual" is still indexed for AI and no request went to OpenRouter

Scenario: A file attached to the machine and its machine model shows once
  Given "MM Operations Manual" is attached to the machine "LG-042" and to its machine model "Medieval Madness"
  When a team member opens the machine record of "LG-042"
  Then it shows "MM Operations Manual" once, under Manual, with the mark „Modell“

Scenario Outline: Adding on the machine record adds and attaches in one step
  Given AI is on
  When a team member sends <the form> with the chosen file named "<name>", a title and "nur LG-042"
  Then the machine record of "LG-042" shows the file, with the confirmation as before
  And the journal records the file added and attached to "LG-042" in one step
  And the file has the original file name "<name>"
  And the run started by adding it indexes the file for AI

  Examples:
    | the form        | name                   |
    | „Datei anhängen“ | medieval_manual-v2.pdf |
    | „Foto aufnehmen“ | IMG_2041.jpg           |

Scenario: Content uploaded by another team member is not added
  Given Anna has a pending upload that she has not added yet
  When Tom sends the form „Datei anhängen“ naming Anna's pending upload, with a title and a file category
  Then no file is added
  And the rejection says that the file must be chosen again
  And the title and the file category are still filled in

Scenario: A file added on the machine record is searched by an AI assessment as before
  Given AI is on, and a team member added "Wiring notes" for "nur LG-042" and "MM Operations Manual" for every machine of the machine model "Medieval Madness", both indexed
  And "LG-043" is of the same machine model
  When an AI assessment of a defect of "LG-043" is written
  Then the AI index is searched among "MM Operations Manual" only

## Out of Scope
- An AI assessment following what a file is attached to, AI index events without a machine, the form „KI“ (ST-120)
- File details (ST-114), attaching and detaching a file that exists (ST-115)
- Showing the original file name and using it as the download name (ST-119)
- Searching in the words of passages and storing them (ST-118)
- Re-indexing anything, any change to what the AI index holds of a file

## Open Questions
- none

## Notes
- **Split in the story review (user, 2026-11-02, `docs/reviews/2026-11-02-story-review.md`, decision 1):** this story is the foundation, ST-120 the AI's side. The app works after this story alone.
- **Moved here from ST-119 (requirements engineer, 2026-11-02): CMD-AddFile on the machine record and storing the original file name.** `makesAiWork` decides by the event's type. EVT-FileAttached has to stop making AI work no later than ST-115's CMD-AttachFile, and then the machine record's form must already record EVT-FileAdded, or a file added there would not be indexed. EVT-FileAdded carries the original file name, a name not stored at that moment is lost for good, and ST-118 searches it. ST-119 keeps the overview's form, showing the name and using it for the download.
- **The migration is proven with `isolatedTestDatabase(...).reset("<tag before>")`,** data inserted as production had it, then `.migrate()` (conventions, migration tests). The first scenario's fixtures include what production has and tests rarely have: removed files, a file with a pending AI entry, a failed entry, an entry of an old embedding model, a file whose machine was retired. No Vercel preview testing (decision of 2026-11-01), so this test is the only proof before production, which is why the risk is high.
- **Tests of done stories whose setup changes** (behaviour and titles stay; `docs/engineering/conventions.md`, *A scenario kept with a new set-up keeps its title and test*):
  - ST-106 "An attached PDF manual is indexed page by page" and "Files attached while AI is off are indexed when it is turned on": from "attached" to "added", and the tests move with it.
  - The unit test of `makesAiWork` asserts EVT-FileAttached; it and the doc comment in `src/modules/ai-assistance/ai-work-events.ts` change to EVT-FileAdded with this story.
  - ST-107 "Only the files of the defect's machine and its machine model are searched" and "A reference to a file outside the defect's machine and its machine model is dropped": the owner of the file becomes its attachment here; their owner on the AI index entry follows with ST-120.
  - ST-085's checklist item "for one owner (machine or machine model)" is already superseded by ADR 0018; it has no test.
- No done scenario is superseded by this story. ST-109's goes with ST-120.

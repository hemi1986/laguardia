---
id: ST-120
title: An AI assessment follows what a file is attached to
type: story
context: BC-AiAssistance
priority: should
size: M
risk: medium
events: [EVT-AiAssessmentWritten, EVT-FileIndexedForAi, EVT-FileIndexingFailed, EVT-FileIndexingRetried, EVT-FileLeftAiIndex]
depends_on: [ST-113, ST-107, ST-109]
labels: [feature:files, ui]
status: in-progress
---

## Story
As a team member, I want an AI assessment to find a file through what the file is attached to now, so that a manual attached to several machines and machine models is found wherever it is attached, and is not found where it is not.

## Context
Feature `files` (user, 2026-11-02; `docs/domain/events.yaml` **AGG-AiIndexEntry**, **CMD-WriteAiAssessment**, invariants of
**AGG-AiAssessment**, **RM-AiSettings**; `docs/architecture/data-model.md`, sections *AI index entry*, *AI assessment*;
`docs/domain/context-map.md`, *Collection → AI assistance*; `docs/adr/0018-files-without-an-owner.md`). Split off ST-113
(`docs/reviews/2026-11-02-story-review.md`, decision 1). Changes the done stories ST-106, ST-107 and ST-109; none is
reopened. ST-115 depends on this story, so the first file attached to a second thing finds the machine columns gone.

**The AI index entry loses its machine columns (migration):** it no longer names a machine or machine model. The
migration re-indexes nothing and calls no AI: what is indexed stays indexed, what waits keeps waiting, what failed stays
failed with its reason.

**AI assessment (CMD-WriteAiAssessment, invariants of AGG-AiAssessment):** the files attached to the defect's machine
or its machine model, each once, are read from Collection **once, when the writing begins**. That one list limits the
search, is what the chat model is told and is what references are checked against. A file attached meanwhile is
neither searched nor offered; a file detached meanwhile keeps its reference. Only entries of the current embedding
model are searched (ADR 0014, unchanged). Written AI assessments never change.

**Journal:** the events of the AI index (EVT-FileIndexedForAi, EVT-FileIndexingFailed, EVT-FileIndexingRetried,
EVT-FileLeftAiIndex) carry no machine reference from now on. Everything that reads the journal, like „Kosten der
KI-Erfassung bisher“, accepts earlier entries that do.

**The form „KI“ (RM-AiSettings):** counts every file that is not removed. The failed files show title and reason only,
since a file no longer has one owner: „Attract mode.mp4 – Dateiformat wird nicht erfasst“. The reason texts and
„Erneut versuchen“ stay as in ST-109, and the title leads to the file details if ST-114 has been built.

## Acceptance Criteria

Scenario: An AI assessment searches only what is attached to the machine or its machine model
  Given AI is on, and "MM Operations Manual" is attached to the machine model "Medieval Madness", "Wiring notes" to the machine "LG-042" and "Eight Ball Manual" to the machine "LG-050", all indexed
  And "LG-042" is of the machine model "Medieval Madness"
  When an AI assessment of a defect of "LG-042" is written
  Then the AI index is searched among "MM Operations Manual" and "Wiring notes" only
  And the chat model is told those two files
  And a reference to "Eight Ball Manual" in its answer is dropped

Scenario: A file attached to both is searched and offered once
  Given AI is on and the indexed file "MM Operations Manual" is attached to the machine "LG-042" and to its machine model
  When an AI assessment of a defect of "LG-042" is written
  Then the chat model is told "MM Operations Manual" once

Scenario: The files read when the writing begins count for the whole AI assessment
  Given AI is on and an AI assessment of a defect of "LG-042" is being written, with "Wiring notes" attached to "LG-042" when the writing began
  When "Wiring notes" is no longer attached to "LG-042" and "Backbox schematic" is attached to it before the chat model answers, naming both
  Then the written AI assessment keeps the reference to "Wiring notes"
  And the reference to "Backbox schematic" is dropped and that file was neither searched nor offered

Scenario: The AI index stays whole when its entries lose their machine
  Given "MM Operations Manual" is indexed, "Wiring notes" waits and "Attract mode.mp4" failed as format not indexed
  When the migration has run
  Then the form „KI“ shows the same counts and the same reason, and no request went to OpenRouter
  And an AI assessment of a defect of a machine that "MM Operations Manual" is attached to finds it

Scenario: The events of the AI index name no machine
  Given AI is on and the PDF "Wiring notes" is attached to "LG-042"
  When it is indexed, and later removed
  Then the journal records both steps of the AI index without naming "LG-042" or any other machine

Scenario: The cost so far counts journal entries from before and after the change
  Given the journal holds an indexing of 0.10 dollars naming a machine, from before this change
  And an indexing of 0.05 dollars that names no machine
  When a technician opens „Einstellungen“ with AI on
  Then the overview in the form „KI“ shows the cost of indexing so far as „0,15 $“

Scenario: Failed files no longer name a machine
  Given AI is on and "Attract mode.mp4", which is attached to "LG-042", failed as format not indexed
  When a technician opens „Einstellungen“
  Then the failed files list „Attract mode.mp4 – Dateiformat wird nicht erfasst“ with „Erneut versuchen“
  And the line does not name "LG-042"

## Out of Scope
- Attaching and detaching a file that exists (ST-115)
- That a failed file leads to its file details (ST-114)
- Re-indexing anything, any change to what the AI index holds of a file

## Open Questions
- none

## Notes
- **Done scenario this story supersedes** (`docs/engineering/conventions.md`, *A scenario of a done story that a later story supersedes*): ST-109 "Failed files are listed with what they belong to and why" goes into `docs/stories/superseded-scenarios.json`, and its test goes with this story's change. ST-109's other scenarios still hold.
- **Tests of done stories whose setup changes** (behaviour and titles stay): ST-107 "Only the files of the defect's machine and its machine model are searched" and "A reference to a file outside the defect's machine and its machine model is dropped" set up the owner on the AI index entry, and that goes. The fixtures of ST-106 and ST-109 that name an owner on the entry follow the new shape without changing what they assert.
- The migration is proven like ST-113's (`isolatedTestDatabase(...).reset("<tag before>")`, then `.migrate()`), with an entry of an old embedding model among the fixtures. Dropping the columns is hard to reverse (ADR 0018).
- CMD-AttachFile and CMD-DetachFile arrive with ST-115. So the scenario "The files read when the writing begins …" changes what is attached in the test's data during the fake chat model's answer, and "A file attached to both …" sets up its two attachments there.

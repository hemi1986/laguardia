---
id: ST-106
title: Files of machines and machine models are indexed for AI
type: story
context: BC-AiAssistance
priority: should
size: L
risk: high
events: [EVT-FileIndexedForAi, EVT-FileIndexingFailed, EVT-FileLeftAiIndex, EVT-AiSettingsChanged]
depends_on: [ST-104, ST-112]
labels: [feature:ai-assessment]
status: ready
---

## Story
As a team member, I want the manuals, schematics and images of the machines and machine models to be indexed for AI as soon as AI is on, so that an AI assessment can find the right page of the right manual for a defect.

## Context
Feature `ai-assessment` (user, 2026-10-31; `docs/domain/events.yaml` **AGG-AiIndexEntry**, **CMD-IndexFileForAi**,
**CMD-RemoveFileFromAiIndex**, **EVT-FileIndexedForAi**, **EVT-FileIndexingFailed**, **EVT-FileLeftAiIndex**,
**POL-AiIndexFollowsTheSettings**, **POL-AttachedFileIsIndexedForAi**, **POL-RemovedFileLeavesAiIndex**, resolved
**HS-29**; `docs/architecture/data-model.md`, section *AI index entry*; ADR 0014; ADR 0015;
`docs/domain/context-map.md`, *Collection → AI assistance*). No screen of its own: the AI index is shown by ST-109
(overview, „Für die KI nicht lesbar“) and used by ST-107 (AI assessments). Indexing a file is the first kind of work
the background work of ST-112 takes. Revised after the story review
`docs/reviews/2026-10-31-ai-assessment-story-review.md` (user, 2026-10-31): the background-work foundation moved to
ST-112.

**What is indexed** (rule, `EVT-FileIndexedForAi`; user, 2026-10-31): every file of every machine and machine model,
whatever its file category –
- a **PDF** page by page: its text layer as a passage and the page rendered as an image, each with its page number.
  No OCR – a scanned page without a text layer is found through its page image;
- a **Markdown** or **text** file: its text in passages;
- a **PNG, JPEG or WebP** image: the image.
- Any other format fails with **"format not indexed"**; a file that cannot be read (damaged, password-protected)
  fails with **"not readable"**; OpenRouter refusing or not answering fails it with **"OpenRouter refused"** or
  **"OpenRouter not reachable"** (EVT-FileIndexingFailed).

**Invariants of the AI index entry this story has to keep:** a file has at most one AI index entry, which refers to
the file and its machine or machine model; it is either indexed – with passages, page images and images all made with
the one embedding model it names – or failed with exactly one reason and none of them; indexing a file again replaces
the entry as a whole, never a mix of two indexings (AGG-AiIndexEntry). A file without an entry for the current
embedding model is *waiting* – derived, never stored.

**When a file is indexed** – in the background, never while the team member waits (ADR 0015, ST-112):
- **attached while AI is on** (POL-AttachedFileIsIndexedForAi) – the page that attaches the file starts the work after
  its response; Collection does not know AI;
- **AI turned on** (POL-AiIndexFollowsTheSettings) – every waiting file, also more than one run can do: a run that
  reaches its budget continues itself (ST-112);
- **only while AI is on – checked before every request to OpenRouter** (rule; user, 2026-10-31, story review, following
  `docs/product/vision.md`: nothing reaches the AI while AI is off). AI turned off meanwhile stops the indexing: nothing
  more is sent, nothing of the file is kept and it stays waiting without an entry – no failure is recorded. Turning AI
  off keeps the AI index (POL-AiIndexFollowsTheSettings).
- A policy run skips a file that already has an entry for the current embedding model (rule), and two runs never
  index – and pay for – the same file at the same time (holds, ST-112).

**Removal (HS-29):** a removed file leaves the AI index in the same step as its removal – also while AI is off – and
an indexing that read the file before the removal never brings it back (POL-RemovedFileLeavesAiIndex,
CMD-RemoveFileFromAiIndex; the file's removal lock, taken by Collection's `CMD-RemoveFile` and shared by the
indexing's store step, ADR 0014). The journal records EVT-FileLeftAiIndex only when the file had an entry.

**Cost:** every indexing records what OpenRouter charged (EVT-FileIndexedForAi *Cost*); ST-109 shows the sum.

**Definition of done** (not scenarios):
1. ADR 0014 and ADR 0015 are accepted by the user before this story is built; the spike ST-105's result is in the
   Notes below and its way of indexing a large PDF is followed.
2. Every request to OpenRouter asks only for providers that neither keep nor train on the data (ADR 0014,
   `docs/product/vision.md`).
3. The new runtime dependencies (`pdfjs-dist`, `@napi-rs/canvas`) are watched by the dependency routine (ST-063).
4. The pull request goes through the normal review lane plus `/code-review` (L, the change to Collection's removal) and
   `/security-review` (uploaded PDFs parsed with `pdfjs-dist` and a native canvas are untrusted input; the key is
   decrypted inside a run).

## Acceptance Criteria

Scenario: An attached PDF manual is indexed page by page
  Given AI is on with the embedding model "google/gemini-embedding-2"
  When a team member attaches to the machine model "Eight Ball" a 3-page PDF manual whose page 2 is a scan without text
  Then the manual is indexed for AI with "google/gemini-embedding-2" and counts 3 pages
  And pages 1 and 3 are in the AI index by their text and as images, page 2 as an image, each with its page number
  And the cost of the indexing is recorded

Scenario: Markdown, text files and images are indexed
  Given AI is on
  When a team member attaches a Markdown file and a text file to the machine "LG-042" and a PNG, a JPEG and a WebP photo to its machine model
  Then the Markdown and the text file are in the AI index by their text
  And each of the three photos is in the AI index as an image

Scenario: A file of another format is not indexed
  Given AI is on
  When a team member attaches the video "Attract mode.mp4" to the machine "LG-042"
  Then indexing it fails with the reason "format not indexed"
  And nothing of it is in the AI index

Scenario: A file that cannot be read fails as not readable
  Given AI is on
  When a team member attaches a damaged PDF to the machine "LG-042"
  Then indexing it fails with the reason "not readable"
  And nothing of it is in the AI index

Scenario Outline: A failure at OpenRouter keeps nothing of the file
  Given AI is on
  And OpenRouter <what OpenRouter does> after the first 2 pages of a 5-page manual
  When the manual is indexed
  Then indexing it fails with the reason "<reason>"
  And none of its 5 pages is in the AI index

  Examples:
    | what OpenRouter does   | reason                   |
    | stops answering        | OpenRouter not reachable |
    | refuses the request    | OpenRouter refused       |

Scenario: Files attached while AI is off are indexed when it is turned on
  Given AI is off
  And 3 files were attached while AI was off, and more than one run of the background work is needed to index them
  When a technician turns AI on
  Then none of the 3 files was indexed while AI was off
  And all 3 are indexed afterwards, without waiting for the next day

Scenario: Turning AI off keeps the AI index and stops an indexing at once
  Given AI is on, the manual "Eight Ball Manual" is indexed, and 2 of the 5 pages of the schematic "Eight Ball Schematic" have been sent to OpenRouter
  When a technician removes the key
  Then "Eight Ball Manual" is still in the AI index
  And no further page of "Eight Ball Schematic" is sent to OpenRouter
  And nothing of "Eight Ball Schematic" is in the AI index, no failure is recorded for it and it counts as waiting
  And a file attached afterwards is not indexed while AI is off

Scenario: A removed file leaves the AI index in the same step
  Given the manual "Eight Ball Manual" is indexed for AI
  And AI is off
  When a technician removes the file "Eight Ball Manual"
  Then nothing of "Eight Ball Manual" is in the AI index once the removal is done
  And the journal records that it left the AI index

Scenario: A file removed while it is being indexed does not come back
  Given AI is on and the manual "Eight Ball Manual" is being indexed
  When a technician removes the file "Eight Ball Manual" before the indexing finishes
  Then nothing of "Eight Ball Manual" is in the AI index after the indexing has finished
  And no indexing of it is recorded

Scenario: A file is indexed once, even when two runs find it
  Given AI is on and the manual "Eight Ball Manual" is waiting
  When two runs of the background work start at the same time
  Then "Eight Ball Manual" is indexed once and its cost is recorded once
  And a later run does not index it again while the embedding model is unchanged

## Out of Scope
- The background work itself – worker route, holds, budget, continuation, secrets, `pgvector` (ST-112)
- Showing the AI index – counts, failed files, cost so far, „Erneut versuchen“, „Für die KI nicht lesbar“ (ST-109)
- The daily retry of failed and left-behind work (ST-108 for left-behind work, ST-109 for failed files)
- Indexing everything again after a change of the embedding model (ST-110)
- OCR, video and audio (user, 2026-10-31; `docs/product/vision.md`)

## Open Questions
- none

## Notes
- Result of the spike ST-105: *to be filled in by ST-105.* If it says a large PDF needs page-by-page progress, the
  invariant "replaced as a whole" changes and this story goes back to `review`.
- OpenRouter and the object store are behind seams (ADR 0014, ADR 0012); tests drive one run directly through ST-112's
  run function with the injected clock, database, AI seam and storage seam – no test waits for a real background run.
- If L proves too large in `/implement`: scenario 1 (PDF) and the PDF rendering become a story of their own after the
  text, image and removal part (story review 2026-10-31).

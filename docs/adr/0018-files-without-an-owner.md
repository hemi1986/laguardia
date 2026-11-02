---
status: accepted
date: 2026-11-02
---

# 0018 – A file has no owner: AI scope read when writing, uploads bound to the team member, content search composed by the page

Supersedes, once accepted and only on these points, three accepted ADRs (not edited):
- `docs/adr/0009-blob-content-consistency-and-abandoned-uploads.md`: a pending upload is issued "for one owner (a machine or a machine model)", and attaching requires it to "belong to the same owner". Everything else of ADR 0009 stands.
- `docs/adr/0015-background-ai-work-with-state-in-the-database.md` and `docs/adr/0017-ai-work-started-by-what-a-command-committed.md`: "attaching a file" / "a file attached" among what starts a run. Adding a file takes its place. Everything else stands.

`docs/adr/0014-ai-through-openrouter-with-a-multimodal-index-in-postgresql.md` is **not** superseded: its search still narrows to the entries of the machine and its machine model with the current embedding model, then orders by cosine distance, and the size that makes an exact search enough does not change. Only its driving requirement "all files of machines and machine models" now reads "all files, also those attached to nothing". Its removal lock is untouched.

## Context and Problem
Feature `files` (user, 2026-11-02; `docs/product/vision.md`, `AGG-File`, `FLOW-FileManagement`): a file is attached to any number of machines and machine models, none included. Three things in the code depend on the old rule that a file has exactly one owner that never changes: the AI index entry copies the owner to limit the search; a pending upload names the owner it was issued for; and nothing has had to search across the file's data and the AI index's text. Dropping the owner columns is hard to reverse – after the first detach or second attach no owner can be restored – and a future reader will wonder why an index holds files no AI assessment can find, why a search over two tables is merged in memory, and why an upload names no machine.

## Driving Requirements
- The AI index holds a file once; attaching and detaching cause no indexing and no cost; a file attached to nothing is indexed but not found by an AI assessment until attached; what a file is attached to when an AI assessment is written counts; written AI assessments and references never change – user, 2026-11-02, `POL-AttachedFileIsIndexedForAi`, `CMD-WriteAiAssessment`
- A file may be added from the file overview, attached to nothing – `CMD-AddFile`, `RM-FileOverview`
- Full-text search over title, original file name, the names of what the file is attached to, and the text of the passages of indexed files, with PostgreSQL full-text search; no OCR, no search by meaning; the index stays searchable while AI is off; best match first, 25 to a page – user, 2026-11-02, `RM-FileOverview`
- Collection is upstream and stays free of AI – `docs/adr/0002-modular-monolith-state-based-persistence.md`, `docs/adr/0010-cross-module-policies-and-retirement-lock.md`; no query over two modules' tables – `docs/engineering/conventions.md`, *Reading across modules – the page composes*
- A few hundred files, one volunteer maintainer – `docs/product/vision.md`

## Considered Options
**How an AI assessment's search is limited**
1. **Read Collection's query for the files attached to the machine or its machine model, once, when the writing begins, and search among those file IDs** – chosen: nothing to keep in step, and attaching needs no policy.
2. Copy the attachments into AI assistance, kept in step by policies on `CMD-AttachFile` and `CMD-DetachFile` – rejected: two more composed commands and a second copy, to save one short query per AI assessment.
3. Join across the two modules' tables – rejected by the convention above.
4. Read again when the result is stored – rejected: a chat answer takes minutes, and a file detached meanwhile would lose its reference although the AI relied on it.

**What a pending upload is bound to**
- **The team member it was issued to** – chosen: already recorded and signed for (ADR 0009). The target of an attachment is now a free choice on the form, so an owner on the upload would protect nothing.
- A nullable owner – rejected: a column nothing checks. A pseudo-owner for "no machine" – rejected: it would pretend that files still have owners.

**Where the search runs**
- **Each module searches its own text; the page data function merges by file ID in memory** – chosen, as `docs/domain/context-map.md` describes: at a few hundred files every step is short, and neither module knows the other.
- A search index over everything in one place (a copy of passages in Collection, or a separate search service) – rejected: a second copy of a large text, and for a service a second system, for no documented need.
- AI assistance owning the overview as the only module that may read both – rejected: Collection's main list would live downstream.
- Ranks of both sources added up – rejected: not comparable. The order is by words found in the file's own data, then its rank, then the rank of the content.

## Decision
- **`AGG-AiIndexEntry` knows no machine and no machine model.** Collection publishes the files attached to a machine or its machine model; `CMD-WriteAiAssessment` reads them once when the writing begins, limits the search with their IDs, tells the chat model that list and checks references against it. Events of the AI index carry no machine reference from now on; earlier journal entries stay as they are.
- **`EVT-FileAdded` makes AI work, `EVT-FileAttached` no longer does.** A file attached to nothing is indexed and paid for like any other.
- **A pending upload has no owner.** It belongs to the team member it was issued to; adding the file requires name, same team member and an age below the fixed one. Everything else of ADR 0009 stands, including deleting the content when the command fails and the cleanup after a later upload.
- **Content search is a query of AI assistance over the words of passages of indexed entries**, stored with the passage and indexed, in German and English word forms together, whatever the embedding model and whether AI is on. Collection searches its own text computed when read. The page composes (`docs/domain/context-map.md`, *The file overview*).

## Consequences
- Positive: attaching costs nothing and no module but Collection takes part. The migration re-indexes nothing and calls no AI; words of existing passages are searchable as soon as the migration ran.
- Negative / cost:
  - Every file costs embeddings even if it stays attached to nothing, by the user's decision.
  - The page reads a few hundred rows per search. It is the first place that would have to change if the file count grew by orders of magnitude; no requirement says so.
  - Storing words next to each passage takes some space in the database, small beside the 1536 numbers per item.
  - The owner columns are gone: which owner a file had first survives only in the journal's `EVT-FileAttached`.
- Follow-up: the engineering conventions (*Files uploaded from the browser*, *Where a file stands in the AI index*, *Writing an AI assessment*) and `src/modules/ai-assistance/ai-work-events.ts` change with the stories that build this.

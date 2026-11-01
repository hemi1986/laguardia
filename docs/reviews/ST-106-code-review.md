# Code review – ST-106: Files of machines and machine models are indexed for AI
Base: main · Commits: 2 · Date: 2026-11-01

Scope read: `git diff main...HEAD` (43 files), the context pack, ADR 0014, ADR 0015, the new sections of
`docs/engineering/conventions.md` (*Background work*; the new replace-list/`insertReplaces`/`removes` paragraph under
*Writing a command*; *Photos and stored content* – `readContent`), `CONTEXT.md`, the three new AI-index files and both
new integration tests.
Checks run: `npx vitest run src/modules/ai-assistance/file-indexing.integration.test.ts
src/modules/ai-assistance/file-removal.integration.test.ts` – 10 passed (isolated PostgreSQL, real database).
`node .claude/skills/implement/scripts/check-language.ts` – 68 warnings: the known `ai` → *Chat model* and
`embedding` → *AI index entry* false positives, plus **two new** ones (`source` in `file-indexing.ts`, finding 8).
The full gate is green (per the task).

Grades are blocker / major / minor. Follow-up hurdle applied: nothing here becomes a new story – every finding is
either fixable in this story within about an hour or a line for the main session.

## What holds

- **Module boundaries** (ADR 0002, ADR 0010): AI assistance reads Collection through its `index.ts`
  (`filesForIndexing`, `fileForIndexing`, `fileForIndexingWhileStoring`) and adds
  `POL-RemovedFileLeavesAiIndex` to `CMD-RemoveFile` with `withPolicies`; Collection names no AI, and the removal
  page composes the exported `removeFileCommandWithAiIndex`. No other module imports AI assistance internals.
- **The removal is one transaction** (HS-29): the policy runs after the removal in the same transaction, as the
  system; `EVT-FileLeftAiIndex` is recorded only when an entry existed, and the entry's items cascade with the row.
  The transaction-scoped advisory lock is taken exclusively by Collection's `facts` and shared by the storing read, in
  the order ADR 0014 prescribes.
- **Journal data** (conventions *The event journal*): `EVT-FileIndexedForAi` carries the model, the counts and the
  cost; `EVT-FileIndexingFailed` the reason; no passages, page images or embeddings reach the journal (asserted in
  scenario 1). No personal data in the new logs (kind + ID only).
- **Time and IDs**: no `new Date()`/`randomUUID()` in domain code – the clock and `newId()` come from the command
  context; the item IDs come from the injected generator.
- **The AI-off stop** works: `aiOn` is asked before every embedding request, `giveUp` ends the hold without an
  entry or a failure, and the scenario test drives a real key removal mid-indexing.
- **The ADR 0014 pipeline** is followed: `provider: { data_collection: "deny", zdr: true }` on every embedding
  request (tested), one item per request, page images at 1024 px/JPEG 75 and **not kept** (only the embedding), pdfjs
  gets `wasmUrl`/`iccUrl`/fonts/CMaps and `outputFileTracingIncludes`, and scenario 1 really proves page 2 is not
  blank.
- **The three command-layer capabilities** are opt-in and leave every existing command and store untouched; the
  docs in `aggregate.ts`/`replaces.ts` and the conventions describe them. `removes` is only evaluated for a changing
  command and the AI removal command works as designed (entry deleted, items cascaded).

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | blocker | Policy trigger | `src/app/(team)/team/machines/[museumNumber]/foto-anhaengen/actions.ts:18-22` | The camera-photo page also runs `CMD-AttachFile` (it creates an AGG-File of category *Photo*, attached to the machine or its model) but its `onSuccess` only redirects – it never calls `startAiWorkAfterResponse()`. A photo attached through this page while AI is on is therefore not indexed until some *other* trigger starts a run, which is the one behaviour `POL-AttachedFileIsIndexedForAi` requires of the attaching page. The existing tests miss it because `attach-file.integration.test.ts` passes its own `onSuccess`. | `POL-AttachedFileIsIndexedForAi`; story *When a file is indexed*; conventions *Background work* ("A Server Action whose command made work … calls it once the command has committed") | Add `startAiWorkAfterResponse()` to this `onSuccess` (one line) and a test that both attach pages start the work (the success callback can be observed at the action seam as ST-112's route tests do). |
| 2 | major | Error mapping – transient → permanent | `src/modules/ai-assistance/file-indexing.ts:169-195` | The `try` around the whole PDF loop also wraps `embedSources` (line 186), which calls `aiOn()` – a database read – and `ai.embed`. Any throw there (a transient pool/DB error while checking the settings, an unexpected bug) is caught as **"not readable"** and, per D3, never indexed again automatically. Text and image files take the opposite path: the same throw propagates and the piece ends as *broken off* (retryable). The same per-format inconsistency hides bugs as a domain reason. Also `loading.destroy()` is not called when `loading.promise` rejects (line 161-166). | Story *What is indexed* ("not readable" = damaged, password-protected, content missing); ADR 0015 / D3 (never retried automatically); smell "error handling that turns transient failures into permanent ones" | Narrow the `try` to pdfjs (`getDocument`, `getPage`, `getTextContent`, `renderPage`) and let embedding/settings errors propagate (or convert only pdfjs' own error types); call `loading.destroy()` in a `catch`/`finally` that also covers the `promise` rejection. |
| 3 | major | Robustness – request parallelism | `src/modules/ai-assistance/file-indexing.ts:18-20,170-186,241` | The PDF path batches by **pages** (`PAGES_PER_BATCH = 2`) but `embedSources` sends *all* items of the batch with one `Promise.all`. A page whose text exceeds `MAX_PASSAGE_LENGTH` yields several passages plus its page image, so a two-page batch regularly fires 5–7 embedding requests at once – against ST-105/ADR 0015 ("one item per request, up to 4 in parallel"). `PARALLEL_REQUESTS` is only honoured by `indexSources`. A rate-limit answer (429) is mapped by the adapter to *"OpenRouter refused"* (`openrouter.ts:189`), i.e. a permanently failed file. | Story Notes (ST-105: "one item per embedding request …, up to 4 in parallel"); ADR 0015 *One item per embedding request* | Chunk inside `embedSources` with `PARALLEL_REQUESTS` (as `indexSources` already does) or size the page batch by items; optionally retry 429/5xx briefly inside the run before recording a failure (a retry within the run is not the forbidden automatic retry of D3). |
| 4 | major | Broken-off recording vs. AI off | `src/modules/ai-assistance/file-indexing-work.ts:74-77` | `recordBrokenOff` skips only when **no embedding model** is saved, but AI is off whenever the key *or* the chat model is missing too (`aiIndexingSettings`: `!!key && !!chatModel && !!embeddingModel`). Removing the key after a crash therefore records a permanent *"broken off"* failure, although the method's own comment (and the conventions) say the file must stay waiting "instead of failing because someone turned AI off after the crash"; turning AI on again would not index it. | `CMD-IndexFileForAi` rules ("AI turned off … stays waiting without an entry – no failure is recorded"); conventions *Background work → Indexing a file*; story scenario 6 | `if (!settings.aiOn || !settings.embeddingModel) return;` – the hold is dropped by `failOneBrokenOff` anyway, so the file waits and is taken when AI is on again. |
| 5 | major | Domain rule placement | `src/modules/ai-assistance/index-file-for-ai-command.ts:12-20`; `file-indexing-work.ts:111-115,77-84` | The rule "The file is not removed – read from Collection in the transaction that stores the entry, under the file's removal lock" is not part of the command but of its two call sites inside the kind; the command is `creates: true` with `insertReplaces`, so `executeCommand(indexFileForAiCommand, …)` from anywhere (ST-109's „Erneut versuchen“ is the obvious next caller) resurrects an entry for a removed file. `owner`, too, is trusted from the input instead of the file the transaction reads (the invariant says it is the file's owner). | `CMD-IndexFileForAi` rule list; ADR 0014; conventions *Writing a command* (`facts` read in the command's transaction; the decision applies the rule); smell Duplicated Code | Give the command `facts: (tx, input) => fileForIndexingWhileStoring(tx, input.fileId)` (or return a rejection when absent), let the decision take the owner from the facts and drop `owner` from the input; both `storeOutcome` and `recordBrokenOff` then just call the command. |
| 6 | major | Test gap – the removal lock | `src/modules/ai-assistance/file-removal.integration.test.ts:144-162` | "A file removed while it is being indexed does not come back" removes the file *before* the store transaction starts (`beforeEmbed`), so it only proves the `fileForIndexingWhileStoring` re-read. The advisory lock itself – a removal that starts *while* the store transaction is open must wait and then delete the entry the store just wrote – is never exercised; moving or dropping `fileRemovalLock` keeps all tests green, and the story calls the lock the guarantee of HS-29. | ADR 0014 (the removal lock); story *Removal*; conventions *Seam catalog* (command against real PostgreSQL, concurrency as in `record-defect-concurrency.integration.test.ts`) | One concurrency test with two real transactions/connections: hold the shared lock through `fileForIndexingWhileStoring`, start the removal in the second connection, assert it blocks, commit the store, then assert the entry is gone. |
| 7 | minor | Language – enumeration values | `src/modules/ai-assistance/ai-index-entry.ts:12-19`; `events.ts:53`; `drizzle/0040_ai_index.sql:8,33` | Failure reasons are stored and journaled as prose (`"not readable"`, `"OpenRouter refused"`, `"broken off"`), against conventions *Domain language and IDs* ("Enumerations are lowercase kebab-case strings"). Repair stores the same kind of model wording (`waiting for part`) as `waiting-for-part`. | Conventions *Domain language and IDs*; `CONTEXT.md` *Broken off* (`_UI (de)_`: abgebrochen); Repair precedent (`holdReasons`) | Use codes (`not-readable`, `format-not-indexed`, `openrouter-refused`, `openrouter-not-reachable`, `broken-off`) and let ST-109 map them to the German texts. Reconcile the wording with `events.yaml` while at it. |
| 8 | minor | Language – glossary | `src/modules/ai-assistance/file-indexing.ts:57,96,237` | `indexSources`/`embedSources`, `ItemToEmbed`'s "source" and the comment "A source that went through OpenRouter" use *Source*, an `_Avoid_` word of *Reference*; the new `check-language.ts` warnings name exactly these two identifiers. | `CONTEXT.md` *Reference* (`_Avoid_`: Source); `check-language.ts` | Rename to `indexItems`/`embedItems` ("item" is the data model's *Index item*). |
| 9 | minor | Interface width | `src/platform/storage/index.ts:36-40`; `file-indexing-work.ts:53-57` | `readContent` returns `{ bytes, contentType }`, but the only production caller uses `.bytes` and the media type from the file record, while `details()` already answers the type. The new seam method is wider than any caller needs. | codebase-design (a shallow field, interface includes what callers need); conventions *Photos and stored content* | Return `Uint8Array \| undefined`, or have the kind use the store's `contentType` (the authoritative one) and drop the record's copy. |
| 10 | minor | Command layer – `removes` shape | `src/platform/command/aggregate.ts:194-199,358-361` | `removes` sits on `Common`, so a **creating** command can declare it and it silently never removes (`expectedVersion !== undefined` is false); and when `removes` is true, `decision.created` is silently dropped (`[]`). Neither is documented nor rejected, so a future command can be wrong in silence. | codebase-design (an interface's invariants are part of it); conventions *Writing a command* | Move `removes` into the `Changing` shape (type-level), and throw when a removing command returns `created`. |
| 11 | minor | Command layer – `remove` precondition | `src/platform/command/aggregate.ts:118-121` | `remove` deletes only the aggregate row and trusts foreign-key cascades; the comment says "the lists go with it", but `aggregateStore` does not enforce that `replaces` (with `ON DELETE cascade`) is the only list kind a removing store has. A store with `histories`/`entities` and `remove` would throw or leave orphans. | conventions *Writing a command* / architecture; codebase-design | State the precondition on `remove` (and in the conventions) and/or throw when a store with `histories`/`entities` is asked to remove; the AI index store is the only intended user. |
| 12 | minor | Test gap – platform capability | `src/platform/command/replaces.ts`, `src/platform/command/aggregate.ts:94-121` | `replaces`, `insertReplaces` and `removes` are proven only indirectly through AI assistance; the platform's own guarantees (a replace-list save removes earlier rows; `insertReplaces` counts the version on; a `removes` command deletes the row and its replaced list) have no `src/platform/command/*.integration.test.ts`, which is where the seam catalog keeps the command layer's proofs. | conventions *Seam catalog* (command layer: `history.integration.test.ts`, `entities.integration.test.ts`, `execute-command.integration.test.ts`); tdd | One short test per capability next to `history.integration.test.ts`. |
| 13 | minor | Duplicated code | `src/modules/ai-assistance/ai-index-entries.ts:66-89`; `events.ts:9-14`; `ai-index-entries.ts:44-58` | Three near-identical `select id from ai_index_entry where …` queries and three copies of the `FileOwner` ↔ `machineId`/`machineModelId` mapping (store row↔state, journal projection, Collection's `files.ts`). | Smell *Duplicated Code* | One `ownerOf(row)`/`ownerColumns(owner)` helper in `ai-index-entry.ts` and one entry-query helper with an optional model filter. |
| 14 | minor | Stale key/model during a long indexing | `src/modules/ai-assistance/file-indexing-work.ts:47-62` | `settings.key` and `embeddingModel` are read once before indexing; only the boolean `aiOn` is re-read per request. A key rotated mid-indexing makes every further request answer *"OpenRouter refused"* – a permanent failure although AI is on and the new key works. | `CMD-IndexFileForAi` rule ("checked before every request"); ADR 0014 (the key is decrypted only to call OpenRouter); D3 | Let the per-request check return the current settings (key + model) and use them for that request. |
| 15 | minor | Speculative exports | `src/modules/ai-assistance/index.ts:17-22` | `indexFileContent` and `IndexingOutcome` are exported from the module's public interface with no consumer at all (not even a test); `aiIndexEntryOf`, `aiIndexedFileIds`, `hasAiIndexEntry` and `indexFileForAiCommand` are exported only for ST-109. A module's `index.ts` is commands and read-model queries. | Smell *Speculative Generality*; conventions *Module layout* ("A module's `index.ts` exports commands and read-model queries") | Drop `indexFileContent`/`IndexingOutcome` from the public interface; keep the ST-109 read models only if the next story lands soon. |
| 16 | minor | Format detection – Markdown | `src/modules/ai-assistance/file-indexing.ts:60-66,77-81` | Text is recognized only by the exact media types `text/plain`, `text/markdown`, `text/x-markdown`. The upload stores `file.type \|\| "application/octet-stream"` (`src/upload/upload-file.ts:37`), so a `.md`/`.txt` for which the browser declares nothing fails permanently as *"format not indexed"* – scenario 2 names a Markdown file. | Story scenario 2; `CMD-IndexFileForAi` rule (Markdown and text are indexed) | Verify in a browser what `.md` declares; if it is empty, fall back on the file name's extension for the text formats (or accept `application/octet-stream` for the text branch after a BOM/UTF-8 check). |

## Pass 2 – the three new command-layer capabilities, one by one

- **`replaces`** – minimal and safe: opt-in, saved after the aggregate row write, so two concurrent saves serialise
  on the row lock and never mix; the delete-then-insert is the right semantics for "an entry replaced as a whole"
  and it is documented in the conventions. The AI index store is its only user and the item table cascades from the
  entry. No issue beyond finding 12 (no platform-level proof) and finding 11 (the cascade is a convention, not a
  typed precondition).
- **`insertReplaces`** – minimal and safe: opt-in, replacing a row counts the version on, `toState`/`toRow` keep the
  state and failed/indexed shapes disjoint (enforced again by the migration's CHECK constraints). It bypasses the
  optimistic version check by design (the entry is identified by the file), which is safe because its only writer is
  the hold-guarded background work; the removal lock, not the version, is what serialises it against a removal.
- **`removes` + `store.remove`** – minimal and safe for the one command that uses it; the AI removal command is a
  changing command run by a policy, so `expectedVersion` is set from the locked row and the branch is taken. The
  gaps are the shape issues in findings 10 and 11, not a defect of the removal itself.

## Verdict
**fix blockers first** – the camera-photo page never starts the AI work (finding 1, a one-line fix), and the five
majors should be fixed in this story as well (all well under an hour; none needs a new story).
Most important after the blocker: finding 2 – the broad PDF `catch` turns a transient settings/embedding error into
a permanent *"not readable"* failure, which D3 then never retries.

---

## Pass 3 – bug-focused (fix commit `0cf991a`)

Re-read `git diff main...HEAD` (47 files) and the fix diff `1c3364d..0cf991a` (20 files). Ran
`npx vitest run src/modules/ai-assistance/file-indexing.integration.test.ts
src/modules/ai-assistance/file-removal.integration.test.ts src/platform/command/replaces.integration.test.ts` –
3 files, 18 passed – and the removal file five times in a row (4 passed each), stable in isolation.
`check-language.ts`: the two new `source` warnings are gone (the remaining ones are the pre-existing `PhotoSource`
and `ai`/`embedding` false positives).

### The findings of Pass 1, one by one

| # | Finding (short) | State | Note |
|---|---|---|---|
| 1 | Photo page never starts the AI work | **fixed** | `foto-anhaengen/actions.ts:24` calls `startAiWorkAfterResponse()`. No test asserts the trigger (the scenario tests drive the kind directly); a three-line action test would close it – see P3.4. |
| 2 | PDF `catch` turned transient errors into "not readable" | **fixed** | The `try` now wraps only the page loop (`file-indexing.ts:170-188`); `embedItems` sits outside it and a throw reaches `workOn`, which keeps the hold. `loading.destroy()` is also called on the `getDocument` rejection (line 162). Residual: see P3.1. |
| 3 | More than four embedding requests in parallel | **fixed** | `embedItems` slices by `PARALLEL_REQUESTS` (`file-indexing.ts:248-277`); the page batch no longer decides the concurrency. |
| 4 | `recordBrokenOff` recorded *broken off* while AI was off | **fixed** | `!settings.aiOn \|\| !settings.embeddingModel` (`file-indexing-work.ts:72`); the hold is still dropped by `failOneBrokenOff`, so the file waits. Not tested – see P3.5. |
| 5 | The removed-file rule lived only in the kind | **fixed** | `facts: fileForIndexingWhileStoring` (`index-file-for-ai-command.ts:20`), the owner comes from the facts, `file-removed` rejects. Safe inside `storeResult` – see below. Test gap – see P3.3. |
| 6 | The removal lock had no concurrency test | **partly fixed** | The new test proves the outcome; its readiness check is porous – see P3.2. |
| 7 | Failure reasons are prose, not kebab-case | **open** | Unchanged (`ai-index-entry.ts:12-19`). Stays minor. |
| 8 | `source` (`indexSources`/`embedSources`) | **fixed** | Renamed `indexItems`/`embedItems`; the new warnings are gone. |
| 9 | `readContent` returned an unused `contentType` | **fixed** | Returns `Uint8Array \| undefined`; the storage test and the S3 test follow. |
| 10 | `removes` on a creating command silently ignored | **fixed** | Moved to `Changing` (`aggregate.ts:274-279`); a removing command that creates others throws (line 367). |
| 11 | `store.remove` trusted an untyped cascade | **fixed** | Throws for a store with histories/entities (`aggregate.ts:118-124`). No existing store is affected (only `removes` user is the AI policy, whose store has only `replaces`). |
| 12 | No platform-level proof of `replaces`/`insertReplaces`/`removes` | **fixed** | `replaces.integration.test.ts` proves replace-as-a-whole (version 0 → 1), the empty replace, removal with cascade and `not-found`; literals, no tautology. Two new throw branches untested – see P3.8. |
| 13 | Duplicated entry queries and owner mappings | **fixed** | One `entryIds` query, `ownerOf`/`ownerColumns`. |
| 14 | Stale key and model during a long indexing | **fixed** | `settings()` is read per request; a rotated key is used, a changed model gives up before the request, so no entry mixes two models. |
| 15 | Speculative public exports | **fixed** | The module index keeps only `removeFileCommandWithAiIndex`; `aiIndexingSettings` (which returns the decrypted key) no longer crosses the module boundary – a security improvement too. |
| 16 | Text media types exclude `application/octet-stream` | **open** | `isText` unchanged (`file-indexing.ts:66-67`). Stays minor; the acceptance review's edge-case table has it too. |

### The questions of this pass, answered

- **Is the `file-removed` rejection safe inside `storeResult`?** Yes. `storeResult` deletes the hold in the outer
  transaction first (`ai-work.ts`), then runs the command through `executeCommand(…, { db: tx })`, which opens a
  **savepoint** on the given transaction. `runInTransaction` throws `Rejected` for a decision rejection, the
  savepoint rolls back, `executeCommand` catches it and returns `{ ok: false }` **without rethrowing**; the outer
  transaction keeps the hold deletion and commits. So a removed file's piece ends its hold and records nothing –
  it is not recorded *broken off* later. Two residual notes: `storeResult` still answers `"stored"` (misleading but
  unused), and no test asserts the hold is gone (P3.3).
- **Does `recordBrokenOff` still work?** Yes: it now only builds the input; the command's facts read the file under
  the shared lock and the decision takes the owner from them. The new test "a file whose indexing broke off is
  recorded failed as broken off" proves the whole path (a run cut off at the first embedding, the next run recording
  it, and no later run taking it).
- **`loading.destroy()` on every path?** Yes on the `getDocument` rejection (explicit `catch`), on every normal and
  early return (the `finally`), and on a thrown `embedItems`/page error (the `finally`). The only hole is a
  rejecting `destroy()` itself (P3.1).
- **Do `embedItems` errors propagate and keep the hold?** Yes: `embedItems` is called inside the `try` that has only
  a `finally`, so a throw leaves `indexPdf`, reaches `workOn`'s `catch`, the hold stays and the piece is recorded
  *broken off* after its hold ran out. (The image path's only `catch` wraps `loadImage`; the text path has none.)
- **Can an entry still mix two embedding models?** No. Every request uses the model the run started with
  (`ai.embed(now.key, embeddingModel, …)`), and a change of the model makes the *next* request give up before it is
  sent; a given-up run stores nothing. An entry is only stored when no request saw another model, and it names that
  one model.
- **Can a rotated key be used safely?** Yes: `settings()` is re-read before every request and `now.key` is what the
  request carries; the old key is never reused. A key removed between the read and the request's completion can
  still complete one in-flight request (unavoidable; the rule says "checked before every request").
- **Does the removal test prove the exclusive lock blocks behind the shared one?** The production path is correct
  (the shared `pg_advisory_xact_lock_shared` in the facts is held to the outer commit, the removal's
  `pg_advisory_xact_lock` waits, then its policy removes the new entry), and the test exercises exactly that. But
  its readiness check is cluster-wide (P3.2), so it can also pass if the lock were removed.

### New findings

| # | Severity | Area | File:line | Finding | Source | Suggested direction |
|---|---|---|---|---|---|---|
| P3.1 | minor | Error handling | `src/modules/ai-assistance/file-indexing.ts:195-196` | `finally { await loading.destroy(); }` is not guarded: a rejecting `destroy()` replaces the return value, so a fully indexed (and fully paid) PDF ends as a thrown error and the piece is recorded *broken off* later – the exact class finding 2 removed. The `getDocument` branch (line 162) already guards it. | ADR 0015 (what breaks off fails), consistency with line 162 | `await loading.destroy().catch(() => undefined);` in the `finally` too. |
| P3.2 | minor | Test quality | `src/modules/ai-assistance/file-removal.integration.test.ts:133-143` | `waitUntilTheRemovalWaits` polls `pg_stat_activity` **cluster-wide** (`datname` is not filtered); the isolated test databases live in the same PostgreSQL cluster and Vitest runs test files in parallel, so another file's advisory wait (museum number, retirement, another removal) satisfies the poll. The test can then pass even if `fileRemovalLock` were removed: the removal may commit before the store (then the store writes the entry afterwards → the final assertion would fail) or after it (then it deletes the entry → the test passes). It is not deterministic proof of the lock. | ADR 0014 (the lock); seam catalog (concurrency against real PostgreSQL); tdd | Filter `datname = current_database()` and `pid <> pg_backend_pid()` (or poll `pg_locks` for a not-granted advisory lock of this database); then a missing lock makes the helper throw after its 4 s and the test red. |
| P3.3 | minor | Test gap | `file-removal.integration.test.ts:159-176` | The "removed while it is indexed" test asserts the outcome but not that the `file-removed` rejection **ended the hold**: if `storeResult`'s rollback behaviour regressed, the hold would stay and the file would be recorded *broken off* by a later run. | ADR 0015 ("the hold ends with the piece's result … or when the run gives it up"); CMD-IndexFileForAi rule | After the run, assert `ai_work_hold` is empty for the piece and that a further run adds no `EVT-FileIndexingFailed`. |
| P3.4 | minor | Test gap | `file-indexing.integration.test.ts` (foto action) | Finding 1's fix (`startAiWorkAfterResponse` on the photo page) is untested, like the upload page's before it; the scenario tests start the kinds directly, so a future removal of either call would stay green. | `POL-AttachedFileIsIndexedForAi`; conventions *Background work* | One action-seam test per attach page (the success callback can record the start, as ST-112's route tests do), or a browser test. |
| P3.5 | minor | Test gap | `src/modules/ai-assistance/file-indexing-work.ts:70-78` | The AI-off skip in `recordBrokenOff` (fix of finding 4) has no test: a crashed hold plus a removed key must record nothing and leave the file waiting (a later run with the key again indexes it). | CMD-IndexFileForAi rules; conventions *Indexing a file*; story scenario 6 | One test: cut-off hold, `removeTheKey()`, run → no entry; then turn AI on, run → indexed. |
| P3.6 | minor | Broken-off model | `src/modules/ai-assistance/file-indexing-work.ts:75` | `recordBrokenOff` names the **current** embedding model. A hold that broke off under model A and is recorded after a change to B creates a failed entry for B, so ST-110 ("index every file again with the new model") would leave it out; the file is never automatically indexed with B. (Already in the acceptance review's edge cases.) | `CMD-IndexFileForAi` / POL-AiIndexFollowsTheSettings; HS-32 | Record the model the broken work belonged to (the hold would have to carry it) or skip the recording when the model changed; decide with ST-110, not a new story by the hurdle. |
| P3.7 | minor | Version check on removal | `src/platform/command/aggregate.ts:362-370` | A `removes` command skips `store.update`, so the version check is skipped: a removing command run by a **person** at a stale version would delete a newer aggregate. Safe today – the only user is the system policy loaded `FOR UPDATE` – but the capability does not say so. | conventions *Version check* (HS-16); codebase-design (interface invariants) | `DELETE … WHERE id = ? AND version = ?` (and `version-conflict` otherwise), or document `removes` as system-only. |
| P3.8 | minor | Test gap – new guards | `src/platform/command/replaces.integration.test.ts` | The two guards the fix added are untested: `store.remove` throwing for a store with histories/entities (`aggregate.ts:121-122`) and a removing command that returns `created` (`aggregate.ts:367-368`). | conventions *Seam catalog* (command layer); tdd | One short test each next to the existing ones (a store with an `entities` list; a removing decision with `created`). |
| P3.9 | minor | Docs / conventions | `docs/engineering/conventions.md:788-794`, `:465-472` | The conventions were not updated with the fix: *Indexing a file* still says "with no embedding model saved (AI off) `recordBrokenOff` records nothing" (now AI off in full) and describes the re-read as the store transaction's own (it is the command's `facts` now); the replace-list paragraph does not say `remove` throws for histories/entities nor that `removes` is for changing commands with no `created`. | conventions *Background work*, *Writing a command* | One sentence in each bullet. (Also `docs/reviews/ST-106-acceptance.md` still says "no code review exists … branch not pushed" and marks DoD 4 unproven – stale after this commit; update before the PR.) |
| P3.10 | minor | Test quality – weak assertions | `src/modules/ai-assistance/file-indexing.integration.test.ts:307`, `:399-400` | The new "indexed again" test asserts `after.at >= before.at`, but the stepping clock never advances in the test, so the two instants are equal – the line is vacuous. (In the "broken off" test `requestsBefore` holds an embedding model, not requests – naming only.) | tdd (tautological assertion) | `clock.advance(…)` between the two saves and assert a strictly later instant, or drop the line. |

Test isolation is now sound: both files `DELETE FROM file` in `beforeEach`, the AI index and holds are reset, and
each test attaches its own files. The "broken off" test leaves one run pending forever (`void run(...)`); it holds
no transaction or connection while it waits, so it is harmless – just don't copy the pattern into a test that stops
mid-transaction.

---

## Pass 4 – security-focused (uploaded PDFs/images parsed in a run, key decrypted in a run)

### Checked and holds

- **The worker route** (`src/app/api/ai-work/worker-route.ts`, unchanged): only a request carrying
  `Authorization: Bearer <AI_WORK_SECRET>` starts a run; the secret is compared as SHA-256 digests in constant time
  (length and prefix do not leak), a missing or shorter-than-32 secret refuses everything, the answer is 202 and the
  run happens in `after()`. No session and no Origin by design (documented); the secret is `server-only`, never
  reaches a browser or a log, and the start call uses `redirect: "error"` (ST-112). The new triggers
  (`foto-anhaengen`, `datei-anhaengen`, `saveAiSettings`) only add calls to it – no new exposure.
- **The key**: decrypted only inside the run (`aiIndexingSettings`, now *not* exported from the module's public
  interface – the fix removed the one function that handed the decrypted key across a boundary). Sent only in the
  `Authorization` header of a request with `redirect: "manual"` (a 3xx is answered "refused", the key is never
  forwarded). Never journaled (`EVT-AiSettingsChanged` carries only the last four), never logged, never in a read
  model or a page.
- **No SSRF**: the PDF is handed to pdfjs as **bytes** (`data`, never a URL) and pdfjs does not fetch resources
  named inside a PDF; the `wasmUrl`/`iccUrl`/`standardFontDataUrl`/`cMapUrl` roots are fixed local paths derived
  from `require.resolve("pdfjs-dist/package.json")`, not input; the OpenRouter base URL is the fixed production
  host (the env override is ignored on production) and redirects are not followed.
- **No path traversal**: the storage key (`file.content.name`) is server-generated (`files/<uuid>` by the upload
  route, `<owner>/<uuid>.jpg` by the photo module); the browser never chooses it and `withUploadedContent` matches
  it against a pending-upload row. `readContent` is reachable only from the background kind – no page or route
  hands content to the browser through it.
- **What reaches OpenRouter**: only the file's content (one item per request); no other museum data is sent. The
  provider rule is on **every** embedding request – `provider: { data_collection: "deny", zdr: true }` – for text
  and for images (tested). No chat completion is sent in this story, so no prompt/context exfiltration surface.
- **Journal and logs**: `EVT-FileIndexedForAi` carries the model, the counts and the cost – no passages, no
  embeddings, no file title, no person; `EVT-FileIndexingFailed` only the reason. The run logs kind + piece ID and
  an error *name* (never content, never the key), including for a throwing kind.
- **Data at rest and deletion**: passages live in `ai_index_item` (needed to send a hit later), embeddings in the
  vector column; both are removed with the file by `ON DELETE CASCADE` in the same transaction as the removal, also
  while AI is off – HS-29's privacy guarantee holds, and the fix makes `remove` unable to orphan a list.
- **Authorization of the commands**: `CMD-IndexFileForAi` allows `technician`/`system`; the manual retry's rule
  ("only a file that failed") belongs to ST-109, which will call the same command and must add it.

### Findings

| # | Severity | Area | File:line | Finding | Source | Suggested direction |
|---|---|---|---|---|---|---|
| S1 | minor | Resource exhaustion – image decode | `src/modules/ai-assistance/file-indexing.ts:84-92`; `src/modules/ai-assistance/openrouter.ts:174` | An attached image file (up to the upload limit of 100 MB) is (a) copied with `Buffer.from`, (b) **fully decoded** by `loadImage` just to test readability, (c) base64-encoded (≈ +33 %) for the request. A "decompression bomb" PNG/WebP with small bytes but huge dimensions allocates `width × height × 4` bytes in the worker and OOMs it: the run is cut off, the file is later recorded *broken off*, and each manual retry repeats it. Reachable by any team member (helpers may attach files; a camera photo is already bounded by the photo module, this is the file-upload path); each invocation is isolated, so the impact is one worker and its cost, not the application. | ADR 0014 ("images as they are"); DoD 4 (`/security-review`); ADR 0015 (the hold survives a cut-off) | Read the dimensions from the PNG/JPEG/WebP header and reject absurd images before decoding (a new reason or "not readable" – decide), and/or downscale to the page-image bound; this is <1 h, so it stays a line, but the user may prefer a new story for a documented limit. |
| S2 | minor | Resource exhaustion – PDF work | `src/modules/ai-assistance/file-indexing.ts:165-194` | `pages = pdf.numPages` is unbounded and the run budget is only checked **between pieces** (ADR 0015), so a crafted PDF with a huge `/Count` – or one page with megabytes of text turned into thousands of passages – keeps the worker busy until the 300 s kill and pays for every embedding reached; the file is then *broken off* and is paid for again on each retry. This is the accepted D1 limitation ("does not fit one run") applied to a crafted file; a cap would contradict the self-hosting target (the 568-page manual must finish). | ADR 0015 *Accepted limitation on Vercel Hobby*, D1; conventions *Background work* | Document it in `docs/operations/ai-work.md` (a crafted file can consume a run's whole budget); a page/byte ceiling is a product decision, not a fix here. |
| S3 | minor | Hardening – pdfjs | `src/modules/ai-assistance/file-indexing.ts:148-156` | `getDocument` leaves `isEvalSupported` at its default (`true`), where pdfjs compiles data from the untrusted document with `new Function` for speed. `enableXfa` is off by default and `useSystemFonts: false` is set. Not a known vulnerability, but eval of attacker-controlled input is avoidable. | DoD 4 (`/security-review`: untrusted PDFs); least privilege | Pass `isEvalSupported: false` (and `enableXfa: false` explicitly, so a pdfjs default change cannot enable it). |
| S4 | minor | Input validation – embeddings | `src/modules/ai-assistance/openrouter.ts:196-200` | An embedding answer is accepted when `Array.isArray` and the length is 1536; the elements are not checked. A malformed answer can store non-finite/foreign values in `ai_index_item.embedding` (or make the insert throw later, turning a paid request into *broken off*), degrading the search ST-107 will build. | ADR 0014 (a fixed 1536-number embedding); HS-34 | Reject unless every element is a finite number (`refused`); cheap, one predicate. |

**Deployment caveat (not a finding):** `next.config.ts`'s `outputFileTracingIncludes` for `/api/ai-work` is the
only guarantee the wasm/ICC/font/CMap assets reach the function, and a wrong key fails **silently** (blank scanned
pages, ST-105's failure mode). Nothing tests it – the acceptance review's caveat that scenario 1's "scan" is an
embedded PNG is right. Check it once on a preview/deployment (`pdfjs` logs a warning when an asset is missing).

---

## Verdict after the fix commit (supersedes the Pass-1 verdict)

**ready to merge** – the blocker (finding 1) is fixed and the five majors are addressed (finding 6's test exists but
its readiness check is porous – P3.2); the platform capabilities are proven at their own seam; the security pass
found no blocker. The remaining findings are minors: the most important is
**P3.2** – the removal-lock test's cluster-wide `pg_stat_activity` poll can be satisfied by another test file, so the
story's central guarantee is not yet proven deterministically. The security-relevant line to decide with the user is
**S1** (unbounded image decode before the request).
No new finding passes the follow-up hurdle: S1 is a guard of under an hour, S2 is a product decision (a cap against
D1, not a data-loss risk), and P3.1–P3.10 are lines in this file.

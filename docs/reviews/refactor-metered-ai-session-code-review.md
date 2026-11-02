# Code review – refactor-metered-ai-session (candidate 2, architecture review 2026-11-01)
Base: main · Commits: 1 · Date: 2026-11-02

No story: a refactoring meant to be behaviour-neutral. `openRouterSession` is exposed as `piece.openRouter`; `file-indexing.ts`, `file-indexing-work.ts` and `ai-assessment-work.ts` ask through it, and `HeldPiece.recordSpent` is gone. The local verify passed (1558 tests, reported by the main session; not rerun). I ran `open-router-session.test.ts` (6 passed) and `check-language.ts` (no new term; only the usual `ai`, `hit`, `scope`, `embedding` warnings). This review compared the code by reading it and changed nothing, so the statements about what a test would miss come from reading the tests, not from running mutations.

**Result: no behaviour difference beyond the known one, plus one narrow new failure window (#3).** The two majors are test gaps on guarantees this refactoring moved.

## The known difference: accept it

Cost now reaches the hold per request, not per batch.

- **Broken-off cost:** a file cut off mid-batch now counts the requests already answered. This matches the rule better: `EVT-FileIndexingFailed` says "what the run had recorded with its hold", and OPEN_QUESTIONS ST-109 wants what OpenRouter charged recorded. Requests still in flight at the cut-off stay uncounted, as before. Only a broken-off file changes; a stored indexed or failed outcome costs the same (see below).
- **More UPDATEs:** up to four times as many, for example about 1,100 instead of about 280 for a 568-page manual with a text layer. Throughput barely moves, because each UPDATE runs inside its own request's parallel branch. A batch takes about max(embed + update) instead of max(embed) + update. They share a pool of 5 (`platform/database.ts`) with the four `aiState` reads, which were already parallel, so at worst they queue briefly. The row is short-lived and `spent` is a `double precision` column, so there is no rounding to scale. ADR 0015's estimate of 280 pages per run stays valid.
- **The AI assessment's writes on its hold:** harmless to the stored result, because `recordBrokenOff` ignores `spent` and the hold is deleted with the result. They carry no value, though, and the last one creates the window in #3.

## Compared with main: no difference found

**Indexing**
- **Outcome cost:** `spent()` equals the old sum on every path. One session belongs to one `workOn`, and a kind indexes one file in it, so `spent()` covers exactly that file.
  - `failed` from OpenRouter: every branch of the batch has settled before `spent()` is read, so it includes the requests answered beside the failure, as the old `[...embedded, ...answered]` did.
  - `failed` as not readable, with page N damaged: earlier batches only, as the old `costOf(embedded)`.
  - Failing before any request (bad image, damaged PDF, missing content, other format): still the literal 0.
- **Summation order:** the sum now runs in arrival order, not item order. It can differ only in the last float bit; tests use `toBeCloseTo`.
- **Given-up:** still wins over failure within a batch. The hold is deleted, so what was spent disappears with it, as before.
- **Items:** same fields and the same conditional `page` and `text`. `Promise.all` and the filter keep the order, and `Embedded` merely lost its wrapper.
- **Rotated key and changed model:** the key is read per request. `sameModel` is the old inequality, and when it holds `aiNow.embeddingModel` equals the pinned model, so the same model goes on the wire.
- **Empty file:** no request and cost 0, as before.

**AI assessment**
- **Stop before chat:** the prompt and images are assembled first and AI is read right before the request, the same order as main. `"stopped"` fails as `ai-off`; the check comes before `"failure" in answer`, which needs a non-string.
- **Reads:** the number and order of `aiState` reads is unchanged: one at the start and one per request.
- **`filesSearched`:** still comes from the first request's model.
- **`embeddingModel`:** still the model of the last request, including a skipped photo keeping the earlier one. Old and new set it at the same points. A failing request never reaches a stored assessment, so setting it before versus after the answer is unobservable.
- **Written cost:** `(e1 + e2 + …) + chat` in the same order, so it is bit-identical to `embeddingCost + answer.cost`.
- **Failed paths:** `failAiAssessment` takes no cost; a chat failure has no `cost` field and adds nothing. `answer-unusable` was charged and still records nothing.
- **Broken off:** records no cost, because the command has no such input.

**Exceptions**
- **The seam:** the real adapter turns everything into `"unreachable"` or `"refused"` (`openrouter.ts:89-96,199`), so a throw is practically a database error or a stand-in.
- **A throw:** propagates as before, so the hold stays and the piece is recorded broken off later. A late sibling's rejection is absorbed by `Promise.all`, so there is no unhandled rejection.
- **A sibling still in flight after a throw:** with the per-request UPDATE this can now also follow a failed `recordSpent`. The kind has already thrown and the run moves on, so up to three leftover requests may briefly run beside the next piece. Each can still write to its own hold. With only a database outage as the trigger, I see no action needed.

**Late result:** `thisHold` matches `heldBy` only and does not check `heldUntil`, as on main. A write after a recording run deleted the hold changes 0 rows and does not throw.

**Tests:** the only existing test touched is the ST-108 one, and it only gained assertions. No test support changed.

## Findings

| # | Severity | Area | File:line | Finding | Source | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Test quality | src/modules/ai-assistance/ai-assessment-work.ts:109-110; ai-assessment-writing.integration.test.ts:226-260 | No test observes what a written AI assessment stores as `cost` or `embeddingModel` through a run. `cost: piece.openRouter.spent()` replaced the explicit `embeddingCost + answer.cost`, and I found no assertion on a run-written `written.cost` or `written.embeddingModel` in the test files; the `cost: 0.04` in that test is only an input. Replacing the value with `0`, or returning the first model instead of the last, would stay green at this seam. The code is right by reading; the gap is that this refactoring's main swap in this kind rests on reading alone. The session test covers `spent()` only at its own seam, not that the kind writes it. | tdd (scenario's "Then" not checked); CMD-WriteAiAssessment | One integration test in the seam-catalog style: `embeddingCost: 0.01`, chat cost `0.04`, one request photo; expect literal `0.06` and the literal embedding model. A second case with the model changed in `beforeEmbed` between text and photo pins "the last request's model". |
| 2 | major | Test quality | src/modules/ai-assistance/file-indexing.ts:340; ai-settings-change.integration.test.ts:216-241 | No test proves that a model changed during an indexing gives the file up. The ST-110 test changes the model while the only request of a single-passage file is already sent, so no later request meets the check. Other tests cover AI off. So deleting `{ sameModel: embeddingModel }` at line 340 should leave every test green, and an entry would silently mix two models under one `embeddingModel`. On main this gap also existed, but the guard was a required comparison inside the loop. Now it is one optional argument, easier to lose. | ST-110; docstring of `embedItems` ("the entry never mixes two models"); tdd | Integration test: a PDF or long text of more than one batch, model confirmed in `beforeEmbed` at request 1 or 2. Expect no entry for that file with either model mixed, no `EVT-FileIndexingFailed`, and that it waits again. |
| 3 | minor | Behaviour / design | src/modules/ai-assistance/open-router-session.ts:39,54; ai-work.ts:219-224 | The one new failure window. On main nothing wrote between a paid chat answer and `storeResult`. Now, if the `spent` UPDATE after the chat throws, the kind throws, the answer already paid for is lost, and the person sees *broken off* only after the hold runs out (twice the budget). The write it failed on is one `recordBrokenOff` ignores for this kind. The likelihood is low: it needs a database error on the UPDATE, and `storeResult` right after would often fail too. The session's interface states no error mode, and no test covers `recordSpent` throwing. | codebase-design (interface includes error modes); ST-108 | The main session decides: accept it and state the error mode on `OpenRouterSession`, or don't let a failed cost record lose a paid answer. Add a test either way. |
| 4 | minor | Docs | docs/engineering/conventions.md:825; :785 | `settings()` at line 825 describes a parameter that no longer exists; it was already stale on main, and the paragraph above now documents the real mechanism. Line 785 still shows `recordBrokenOff(tx, id, context)` without `spent`, two lines under the new text saying it gets `spent`. A search found no other mention of `recordSpent`, `readAiNow` or `IndexingSettings` outside the new code; ADR 0015, `events.yaml` and ST-106's "checked before every request" stay correct. | Conventions as source of truth | Line 825: "Every request goes through `piece.openRouter` with `sameModel`: a rotated key is used for the next request…". Line 785: add `spent`. |
| 5 | minor | Test quality | src/app/(team)/team/defects/[defectId]/ai-assessment-failure.integration.test.ts:349-351 | The stronger ST-108 assertion is sound but proves less than its comment says. By reading: the text embedding is answered before `beforeChat` hangs, so `spent` really is on the hold at that point. But `cutOff.reportedCost` is counted inside `memoryAi`, not on the hold, and `failAiAssessment` has no cost input. So the test would pass on main too, and it would pass if the session never wrote to this hold. It guards against a future `recordBrokenOff` that records cost, which is useful, but "stood on its hold" is not checked. The hold-writing path itself is covered only by the indexing broke-off test at file-indexing.integration.test.ts:335. | tdd | Keep the assertions and reword the comment to what is checked. If the claim should be pinned, have the stand-in kind in `ai-work.integration.test.ts` use `piece.openRouter` and check `spent` as it reaches `recordBrokenOff`. |
| 6 | minor | Test quality | src/modules/ai-assistance/file-indexing.integration.test.ts:335-363; ai-assessment-work.ts:94 | Two stops stay unpinned through a run. (a) The known difference: the broke-off test cuts off exactly at a batch boundary (`requestNumber <= 4`), so `0.04` holds on main and now. Per-request recording is pinned only at the session's seam. (b) The stop right before the chat: ai-assessment-writing.integration.test.ts:474 stops at the photo's embedding and the ST-108 test before the start, so line 94 is not reached. The same gap exists on main. | tdd | (a) A variant where the second request of the batch hangs and an earlier one is answered, with its literal cost. (b) A request without photos with the key removed in `beforeEmbed` at request 1: expect `ai-off` and no chat request. |
| 7 | minor | Design | src/modules/ai-assistance/file-indexing.ts:116,196,203,215; file-indexing-work.ts:57,91,99 | `IndexingOutcome.cost` is now redundant. `file-indexing.ts` reads `embedding.openRouter.spent()` in four places (a Message Chain), and the `cost: 0` literals must equal `spent()`, which they do because no request came before them. The session already knows the answer. | Smells: Duplicated Code, Message Chains; codebase-design (locality) | Deepening: read `piece.openRouter.spent()` once in `storeOutcome` and drop `cost` from `IndexingOutcome`. |
| 8 | minor | Design | src/modules/ai-assistance/ai-work.ts:19-24,62 | "Never the AI seam directly" holds today by convention only: a kind still gets the whole seam through `context.ai.ai`. Both kinds use `context.ai` solely for `aiState`, which needs only `encryptionKey`, and the stand-in kind doesn't use it at all. | Conventions ("OpenRouter from a held piece"); codebase-design (leaking module) | Narrow `AiWorkContext.ai` to the `encryptionKey` part and keep the full `AiDependencies` on `AiWorkDependencies`. The type checker then enforces the rule. |
| 9 | minor | Conventions | docs/engineering/conventions.md:1016-1018; open-router-session.test.ts | The new test sits at a seam the catalog does not list: the catalog's OpenRouter row names commands and read models with `memoryAi`. The tests themselves go through the session's interface with literal expectations and are good. | tdd (seams from the catalog; others are confirmed with the user) | One catalog row for the session (or confirm it through the architecture review), naming the small seam stand-in. |
| 10 | minor | Naming / comment | src/modules/ai-assistance/file-indexing.ts:45,58 | Line 45 says given-up happens when "the key or model changed", but a rotated key never gives up, and line 51 says so correctly. It was already wrong on main, but the two lines now contradict each other in one file. The local `type Embedding` (now just `{ openRouter, embeddingModel }`) shares its name with the seam's `Embedding` that the session imports. | Smell: Mysterious Name | Line 45: "AI turned off or the embedding model changed". Rename the local type, for example `PinnedEmbedding`, or dissolve it. |

ready to merge
Most important: #1 – nothing tests the `cost` and `embeddingModel` a run stores on a written AI assessment, so the swap to `spent()` is right by reading only; #2 is close behind.

## Resolution (main session, 2026-11-02)

| # | Outcome |
|---|---|
| 1 | **fixed** – an integration test checks the written cost and the embedding model of the last search, with the model changed between text and photo. |
| 2 | **fixed** – an integration test changes the model while a five-page PDF is indexed: nothing is sent with the new model, no entry, no failure. Deleting `sameModel` makes it fail. |
| 3 | **fixed** – a chat's cost is only summed, not written to the hold, so a failed write cannot lose an answer already paid for. An embedding of an AI assessment still writes to its hold. |
| 4 | **fixed** – both lines of the conventions. |
| 5 | **fixed** – the comment says what the assertion proves. |
| 6 | **fixed** – tests cover the stop right before the chat and a cut-off mid-batch. The user accepted the cost per request (2026-11-02). |
| 7 | skipped – `IndexingOutcome` stays a complete answer; reading `spent()` in `storeOutcome` would only move it. |
| 8 | **fixed** – `AiWorkContext.ai` carries only `encryptionKey`, so the type check enforces the rule. |
| 9 | **fixed** – a row in the seam catalog. |
| 10 | **fixed** – the comment, and the local type is `EmbeddingOfFile`. |

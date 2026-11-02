# Code review – refactor-ai-assessment-writing-module (candidate 5, architecture review 2026-11-01)
Base: main · Commits: 1 · Date: 2026-11-02

No story: a refactoring that must be behaviour-neutral. The AI assessment writing rules move without I/O into `ai-assessment-writing.ts`; `ai-assessment-work.ts` keeps reading, asking and storing. The local verify (1570 tests) and `e2e/ai-assessment.spec.ts` passed, as reported by the main session; neither was rerun. I ran `ai-assessment-writing.test.ts` (11 passed) and `check-language.ts`. The checker reports no new term in these two files beyond the usual `hit`, `scope`, `source` and `summary` warnings; `uniqueHits` is one more name with `hit`. This review compared the code by reading it and changed nothing. Statements about what a test would miss come from reading the tests, not from running mutations.

**Result: I found no behaviour difference.** The two majors are a test gap in the rewritten reading code and a missing row in the seam catalog.

## Behaviour compared with `main`

| Question | Finding | Evidence |
|---|---|---|
| Order and number of storage reads and renders | Same. Found files are read file by file and each file once, with `renderPdfPages` once per file. Then come the report photos one after the other, then the request photos. Object literal properties are evaluated in order, so `reportPhotos` is awaited before `requestPhotos`. Every listed photo is still read. | `ai-assessment-work.ts:69-78`, `:192-222` |
| Time of the photo selection | It now runs after the search instead of before it. It does no I/O and works on the same `defect`, so nothing can be observed. | `ai-assessment-writing.ts:49` |
| Order of images, counts in the prompt | Same: found images in hit order, then report photos, then request photos. The counts are those of the photos actually attached. | `ai-assessment-writing.ts:76-90` |
| Content type | Same: an image file keeps its stored type, a rendered page is `image/jpeg`, a photo is `image/jpeg`. | `ai-assessment-work.ts:206`, `:213`; `ai-assessment-writing.ts:79` |
| File gone, content gone, page not rendered, page hit without a number | Same: each gives `image: undefined`, which is left out of both the images and the prompt's list, so later `bild` numbers do not shift. An empty `Uint8Array` is truthy in both the old `!bytes`/`!page` and the new `page &&`/`bytes ?`. | `ai-assessment-work.ts:210-214`; `ai-assessment-writing.ts:77` |
| Text of the prompt | Same. The diff touches only the signature of `buildAiAssessmentPrompt` (no `export`, an inlined type). `systemPrompt` and the sections are not in the diff. | `git diff` |
| Search text | Same expression, moved. Note and descriptions come from the same fields. | `ai-assessment-writing.ts:42-46` |
| Photo selection | Same chain. Reports without a photo are removed before the cap, so they take no slot. Ties in `reportedAt` keep problem report order (stable sort), as before. | `ai-assessment-writing.ts:49-55` |
| Cap and dedupe order | Same: `unique` then `slice`, 12 and 10 unchanged. Passages are deduped and not capped. | `ai-assessment-writing.ts:58-70` |
| Failure reasons and precedence | Same: `stopped` → `ai-off`, then the seam's failure, then `answer-unusable`. `"failure" in outcome` cannot misfire, because the parser returns only its four fields. The request is built and sent at the same point, and the cost and `filesSearched` are unchanged. | `ai-assessment-writing.ts:93-100` |
| `AI_ASSESSMENT_REPORT_PHOTOS`, `AI_ASSESSMENT_FOUND_IMAGES` | Not needed anywhere. On `main` only `ai-assessment-work.ts` used them. No use remains in `src`, `e2e`, `docs` (outside old reviews) or the skills, so removing them is right. `AiAssessmentHits` and the `buildAiAssessmentPrompt` export have no use left either. | `git grep` |
| Module boundaries (ADR 0002) | All imports of `ai-assessment-writing.ts` are `import type`, and those of Repair and Collection go through their `index`. It does no I/O, as claimed. | `ai-assessment-writing.ts:1-6` |

## The deliberate decision: it holds

Keeping the failures for a missing defect or machine model in the work is **right, and it is not what makes the module shallow**.

- **Why it holds:** the failure has to fall before the first embedding is paid for, and `AiAssessmentMaterial` makes the case impossible by its required `defect` and `machineModel`. Both failures are one line each and come directly from a read, and no choice about what to send depends on them.
- **Rejected alternative:** a function that takes the possibly missing defect and returns the search text or a failure would only move two `if`s behind a wider type.
- **The "| failure" of the plan:** `outcomeOfChat` on the answer side is an honest reading of it.
- **What is not covered:** no test drives these two lines, and they did not change here. A missing defect may also not be reachable today.

**Where a better split exists** is in two other places:

1. The selection functions (#3): rules the module owns are still the caller's duty to apply.
2. The failure side of the embedding answers (#4): the same kind of rule as `outcomeOfChat`, left in the work and written twice.

## Depth of the module

- **Deletion test:** passed. Without the module the prompt, the parser, the selection and the attachment rules return to the work. They can now be tested without a database.
- **Deep parts:** `aiAssessmentChatRequest` and `outcomeOfChat`.
- **Shallow part:** `searchTextOf`, `reportPhotosToSend`, `uniqueHits` and `foundImagesToSend` are one-expression functions, each called from one place. Together with the two deep functions, the work imports six functions and must know the order to use them in.

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Test quality | `src/modules/ai-assistance/ai-assessment-work.ts:192-222` | The rewritten reading half is tested only on its happy path. No test in `ai-assessment-writing.integration.test.ts`, `ai-assessment-failure.integration.test.ts`, `ai-work.integration.test.ts` or `ai-settings-change.integration.test.ts` indexes a `kind: "image"` item, and none takes a file or stored content away before a run or leaves a page unrendered (ST-108's "referenced file removed later" removes the file after the writing). The cases this review was asked about therefore rest on reading: an image file's own content type, a hit whose file or content is gone, a page that does not render, a report or request photo that is gone. The new unit test starts from `image: undefined` and `image/png` given by hand, so it proves the module's half only. The gap already existed on `main`, but this branch rewrote the code and changed its return shape. | CMD-WriteAiAssessment rule "a file removed meanwhile is a reference by its title"; tdd skill (seam, scenario proof); seam catalog "a kind's work" row | Add scenarios at the `runAiWork` seam with `memoryStorage`. A found PNG goes out as `image/png`. A found file whose content is gone is left out and the next image is `bild: 1`. A gone photo lowers the count in the prompt. |
| 2 | major | Conventions / seams | `docs/engineering/conventions.md:1004` | The seam catalog has no row for the unit tests of `ai-assessment-writing.ts`, although the new text at `:836` tells everyone to add unit tests there. The catalog says "A seam not listed here is a decision for the user in the test plan". The previous candidate added such a row (`openRouterSession`). The test file's header (`ai-assessment-writing.test.ts:14-17`) still calls this "a seam the story names outside the catalog" and speaks only of the parser. | `conventions.md` Seam catalog; tdd skill "test only at pre-agreed seams" | Add one row (the pure functions, unit, this file) and update the test file's header. If the user has not confirmed this seam yet, mention it at the checkpoint. |
| 3 | minor | Design | `src/modules/ai-assistance/ai-assessment-writing.ts:42-70`, `:28-39`; `ai-assessment-work.ts:62`, `:77`, `:180-181` | Interface wider than the behaviour, and a leak: the caps are the module's rules, but the module does not apply them when building the request. `aiAssessmentChatRequest` sends whatever `foundImages` and `reportPhotos` it is given, so a caller that skips `foundImagesToSend` or `reportPhotosToSend` sends more than the fixed numbers, and only a doc comment says otherwise. The work must also know that passages take `uniqueHits` and images take `foundImagesToSend`. This is the plan's "material in → chat request", not fully reached. Only one caller exists, so the risk is low. | codebase-design: depth, "interface includes ordering constraints"; Data Clumps | Deepening: fold the selection into two steps, one before reading (the search text and the report photos to read) and one after searching (the found passages and images out of the raw hits). That removes `uniqueHits` from the interface and takes the work from six imports to about four. Worth doing on this branch, as depth is the candidate's goal; the main session decides. |
| 4 | minor | Design / Duplicated Code | `src/modules/ai-assistance/ai-assessment-work.ts:161-163`, `:172-174` | The embedding answer's failures (`stopped` → `ai-off`, `unreachable` → `openrouter-not-reachable`, `refused` → `key-invalid`) are written out twice in the work. This is exactly the kind of pure rule `outcomeOfChat` holds for the chat answer, and the new conventions text promises "the answer … or its failure". Unchanged from `main`, but this branch sets the line between the two files. | Duplicated Code; `conventions.md:833-836` | A pure `failureOfEmbedding(answer)` next to `outcomeOfChat`, with a table test. |
| 5 | minor | Design | `src/modules/ai-assistance/ai-assessment-writing.ts:23`, `:82-88`, `:103`, `:200` | Leftover surface. `AiAssessmentSource` and `AiAssessmentAnswer` are exported and imported nowhere. `parseAiAssessmentAnswer` is exported only for its tests and `conventions.md:845`. `aiAssessmentChatRequest` takes the flat material apart and nests it again (`source`, `hits`, `photos`) for the now private `buildAiAssessmentPrompt`. | codebase-design "the interface is the test surface"; Data Clumps | Drop the `export` of the two types and let the private prompt builder read the material's fields directly. The parser's export can stay if its table test is wanted there; say so in the catalog row (#2). Do not delete its tests. |
| 6 | minor | Design | `src/modules/ai-assistance/ai-assessment-writing.ts:79`; `ai-assessment-work.ts:171`, `:213` | The knowledge of which content type an image has now lies in two files: photos sent are `image/jpeg` in the module, while photos embedded and rendered pages are `image/jpeg` in the work. Before the branch all of it was in the work. Each value is still correct. | Shotgun Surgery; `conventions.md:836` "a new rule about what is sent goes there" | Either accept it, as the formats come from upload and rendering, or let the module own one named constant for both files. |
| 7 | minor | Test quality | `src/modules/ai-assistance/ai-assessment-writing.test.ts:87-95`, `:102` | The fixtures bypass the types: `as unknown as AiAssessmentMaterial["defect"]` hides a missing `id` and `holdReason` and a `priority: undefined` that the type forbids, and `machineModel` is cast from `{ title }`. A new required field used by the prompt would not fail at type check. The tests themselves are sound, with independent literals: blank descriptions are left out, a newer report without a photo takes no slot, the duplicate in `[hits[0], ...hits]` would catch cap-before-dedupe, and `images` is compared whole with content types. Only the `bild` number of the kept image is not asserted, although the module's comment promises it does not shift. | tdd skill | Complete the fixtures with their real types, and assert `"bild": 1` next to `"datei": "kept-file"`. |
| 8 | minor | Conventions / comments | `docs/engineering/conventions.md:833-836`, `:843`; `src/modules/ai-assistance/ai-assessment-writing.ts:107` | The conventions text is true for what it lists, with small flaws. It says "The kind reads…" one bullet before the kind is introduced ("the second kind", `:837`). "A new rule about what is sent goes there" reads wider than the facts: the hits per search live in `ai-index-search.ts` and the 5 resolved defects in Repair (`AI_ASSESSMENT_RESOLVED_DEFECTS`). `:843` names `renderPdfPage`, which no longer exists (now `renderPdfPages`; older than this branch). In the code, the type comment at `:107` still says "checked by the caller" while the header at `:13` was corrected to "the command checks" (true: `ai-assessment.ts:194`). | Comments must match the code; conventions | Move the bullet below the kind's, name the two exceptions, correct both words. |

**Verdict: ready to merge** – no behaviour difference found, no blocker; the two majors should still be fixed on this branch.
**Most important finding:** #1 – what happens when a found image or photo cannot be read rests on reading alone, because no test drives the rewritten `readFoundImages` and `readPhotos` through those cases.

## Resolution (main session, 2026-11-02)

| # | Outcome |
|---|---|
| 1 | **fixed** – an integration test sends a found image file, a file whose content is gone, a page that cannot be rendered and a photo that is gone through the work. A file removed before the read stays untested: the removal policy takes its entry, so only a race reaches that line. |
| 2 | **fixed** – a row in the seam catalog. |
| 3 | **fixed** – `whatToRead` applies the caps and replaces `uniqueHits`, `foundImagesToSend` and `reportPhotosToSend` in the interface. |
| 4 | **fixed** – `failureOfEmbedding` beside `outcomeOfChat`. |
| 5 | **fixed** in part – `AiAssessmentSource` is gone, `AiAssessmentAnswer` is private, the prompt builder takes the material flat. `parseAiAssessmentAnswer` stays exported for its tests. |
| 6 | skipped – the file's own type comes from the read, the photos' from what the module knows; moving it would add a parameter for nothing. |
| 7 | **fixed** in part – the test asserts the `bild` number. The fixture casts stay: a test needs only a few fields of the published types. |
| 8 | **fixed** – the bullet follows the kind, its wording is narrower, `renderPdfPages`, and "command" in the comment. |

# Acceptance – ST-105: Indexing the largest manual for AI within one run
Date: 2026-11-01 · Tests run: none (spike, no kept code; `git diff main --name-only` lists only files under `docs/`; `validate-stories.ts` → OK, 109 stories) · Preview: measurements were taken by the user on the spike's preview; not rerunnable here (key is the user's)

## Checklist evidence (spike)
| Item | Evidence in `## Result` / elsewhere | OK? |
|---|---|---|
| Embedding of one image and one text, 1536 numbers, zdr | "Images are accepted for embeddings", provider Google, `data_collection: deny, zdr: true` | yes |
| Setup: key as preview variable, spending limit, ZDR, removed after | Key used as preview variable; spend ≈ 0,08 $. Removal of `ST105_OPENROUTER_KEY` / `ST105_MEASURE_TOKEN` still open (user) | yes, remark |
| Setup: both manuals uploaded to the preview | Only the largest manual (568 pages, scanned with text layer) is reported; no separate "largest text-layer manual". The Result says the manuals are far below 100 MB. | yes, remark (second manual not reported) |
| Run on the preview: read from store, text layer, render, embed | Table column "Vercel preview (Hobby)" | yes |
| Measurements per manual | Pages, time per phase, peak RSS 318 MB, image 792x1024 JPEG q75 ≈ 71 KB, cost per page / total | yes |
| Verdict vs. budget and memory, page threshold | Memory no constraint; ≈ 280 pages per 250 s run; largest manual (568) does not fit | yes |
| Proposal if it does not fit; invariant; ADR 0015 updated | Page-by-page progress record, entry replaced as a whole only at the end; ADR 0015 (still `proposed`) and `data-model.md` updated; consistent (see below) | yes |
| Tokens per page image / text passage | 258 / 274 average; copied to ST-110 Notes | yes |
| Max images for the chat model | 27 images accepted (12+10+5 fit); `gemini-2.5-flash` has no ZDR endpoint; noted in ST-107 Notes | yes |
| Several items per embedding request | Do not work under ZDR (404); one per request, 4 in parallel, no 429 | yes |
| Function size / Docker | Deployed and ran on Vercel, ran locally under Node 24; exact bundle size explicitly "Not measured" | yes (recorded as not answered) |
| Result in story, summarised in ST-112 and ST-106, code not merged, affected stories to `review` | Notes of ST-112, ST-106 (also ST-107, ST-110) filled; ST-112 and ST-106 `status: review`; no non-docs file in the diff | yes |

## Consistency of the domain-architect's changes
- ADR 0015: Hobby limit (300 s, ~250 s budget), `maxDuration` 300, progress-record decision, one-item-per-request decision, cost line - match the Result.
- `data-model.md`: progress record (file unique, model, last page done, items, cost, last touched), invariants hold unchanged (replacement at the end, one model, conditional write, removal lock, waiting stays derived), `CMD-RemoveFile` drops the record - consistent with the Result and with `events.yaml` (CMD-IndexFileForAi text and rule on the removal lock).
- No inconsistency found. `validate-stories.ts` passes.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Code, tests, journal, catalogs, UI | no (spike, nothing kept) | diff is docs only | n/a |
| Secrets / personal data | yes | no key in the repo; spike sent only museum manuals | OK |
| Preview variables removed after the spike | yes | still to be done by the user | remark |

## Edge cases / questions
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| ST-112 checklist still says `maxDuration = 800` and budget 600 s (lines 34, 37, 49); ST-106 likewise | Story Notes say it is back in `review` for exactly this | revise in the story review (already planned, no new story) |
| `docs/domain/event-storming.md` lost its whole "Open Hotspots" section (HS-32..34) in commit 187c1a2; the hotspots still exist in `events.yaml` | not mentioned in the Result | question: intentional (generated view / hotspots resolved) or accident; minor line |
| Not measured: exact bundle size of the function; second manual (text layer) not reported separately; worker-thread rendering | Story allows "not answered" | minor line, ST-106 measures bundle size when built |
| Progress record holds page images' embeddings only (not images) - size of the record for 568 pages (~1136 vectors x 1536) | none | question for ST-112/ST-106 sizing |
| Silent blank rendering without pdfjs `wasmUrl`/`iccUrl` | recorded in Result and ST-106 Notes | ST-106 needs a guard (already noted) |

No finding meets the hurdle for a new story (no security/data-loss risk, all absorbed by ST-106 / ST-112 reviews).

## Verdict
**accepted with remarks** - remarks: remove the preview variables `ST105_OPENROUTER_KEY` and `ST105_MEASURE_TOKEN`; clarify the deleted "Open Hotspots" section in `event-storming.md`; ST-112 and ST-106 checklists (800 s / 600 s) are revised in their story review.

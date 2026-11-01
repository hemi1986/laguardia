# Acceptance – ST-109: See how far the AI index got and try failed files again
Date: 2026-11-01 · Tests run: `npx vitest run --project integration "src/app/(team)/team/museum-settings/ai-index-overview.integration.test.ts"` → 9 passed, 0 failed (a first run collided with the parallel verify run in the shared test database – deadlock in the global setup – and was repeated alone) · Preview: none (tested locally)

## Scenarios
`check-scenarios.ts ST-109`: 9/9 covered. All tests are in `src/app/(team)/team/museum-settings/ai-index-overview.integration.test.ts`.

| Scenario | Test | Given/When/Then really checked? | Result |
|---|---|---|---|
| The overview shows how far the AI index got and what it cost | `ST-109: The overview shows…` | Given built with real attach + one real run (12 indexed, 2 video failed, 3 attached later = waiting; cost via 12 × 0.1025). When: page data rendered by the section view. Then: literal German strings "12 Dateien … · 3 warten … · 2 …" and "1,23 $" asserted. | OK |
| Failed files are listed with what they belong to and why | `…Failed files are listed…` | Real failures (format, unreachable); machine and model owner. Asserts literal owner/title/reason, both German lines and two "Erneut versuchen". | OK |
| Nothing indexed yet | `…Nothing indexed yet` | Asserts empty text, zero counts, no failed list/button. | OK |
| A technician tries a failed file again | `…tries a failed file again` | Real Server Action runner (`formRunner`) with the form definition; asserts landing, run start, confirmation text, waiting 1 / failed 0, then a run indexes it, 1 indexed, not listed. | OK |
| Only a failed file can be tried again | `…Only a failed file…` | Stale page (version from the failed state) posted after Eva retried and a run indexed it; asserts error `file-indexing-not-failed`, no run start, no embed request, journal of the file unchanged, still indexed. "No cost" is covered by the empty embed requests. | OK |
| An indexing that broke off… | `…broke off…` | Cut-off run really hangs in embedding; injected clock past the hold; uses the same `startWhenLeftUnfinished` function the page calls; asserts no start before expiry, start after, no embed request, German line "Erfassung abgebrochen" + button, a later run does not index it, second opening starts nothing. | OK (see remark 1) |
| The machine record marks only files the AI cannot read | `…marks only files…` | Real record loader and view; mark on the failed file only, count of marks = 1. | OK |
| While AI is off neither the overview nor the mark is shown | `…While AI is off…` | Key removed through the real command; overview undefined, no texts, no mark, retry rejected `file-indexing-ai-off`, no embed; AI on again → overview and mark return. | OK |
| Helpers cannot try a failed file again | `…Helpers cannot…` | Helper through the runner: `not-authorized`, no start, no embed, still failed. The "does not reach Einstellungen" line is by the e2e `ST-104: Helpers do not get the AI settings` and `requireTechnician()` (as agreed). | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Every command writes its journal entry | yes | `retryFileIndexingCommand` via `aggregateCommand` with `aiAssistanceEvents.journal`; EVT-FileIndexingRetried in `events.yaml` (l. 412, CMD-IndexFileForAi l. 757–770) and `events.ts`; the confirmation reads the technician's own last journal step | OK |
| Texts from the message catalogs | yes | `src/platform/messages/team/ai-assistance.ts`; view uses `teamMessages.aiIndex` | OK |
| German number notation (G13) | yes | `Intl.NumberFormat("de-DE")`; "1,23 $" asserted | OK |
| Roles / access | yes | `allowedActors: ["technician"]` plus `requireTechnician()` in the action and page | OK |
| Opening the page may start paid work | yes | Only when `ai.overview` exists and a hold ran out (`startAiWorkWhenLeftUnfinished`); tested "starts nothing" cases. `/security-review` is still named in the story's definition of done – not part of this acceptance, for the main session | remark 2 |
| Design size / list performance | partly | Overview is a short text block and a list of failed files only; cost sums all EVT-FileIndexedForAi per page load (journal scan) – fine for the museum's volume | OK |
| No personal data in logs | yes | Nothing logged; only file titles and machine numbers | OK |
| Docs (events, data model, conventions) updated | yes | in the diff | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Two technicians tap "Erneut versuchen" at the same time | Version check on the entry (second gets `file-indexing-not-failed`/version conflict); shown in the "Only a failed file" test for the sequential case | no action |
| File removed between page load and tap | Command doc: `not-found` (POL-RemovedFileLeavesAiIndex) | no action; the German error text for it was not checked by a scenario – question |
| A failed file of an earlier embedding model | `retryFileIndexing` rejects it (counts as waiting already) – consistent with the data model | no action |
| Very many failed files (long list, no paging) | none | question; fine for the museum size |
| Cost while AI is off is hidden | accepted by the story | none |
| Retry when AI is on but the next run fails again at once | Story: "waiting until indexed or fails again" | covered by design |

## Remarks
1. The page-opening scenario drives `startWhenLeftUnfinished` directly, not the page component; the one-line wiring in `page.tsx` (`if (ai.overview) await startAiWorkWhenLeftUnfinished(FILE_INDEXING_KIND)`) is reviewed by reading only. Acceptable (page needs auth/session); wiring is correct.
2. `/security-review` is a named part of the story's definition of done and was not done by this review; I found nothing contradicting it (technician-only, system-only background indexing, no unauthenticated path).

## Verdict
**accepted with remarks** – 9/9 scenarios have real tests that assert the literal values of the story, all pass; no violated rule. Remarks 1 and 2 are not blocking.

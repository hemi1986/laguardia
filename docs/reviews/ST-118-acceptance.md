# Acceptance – ST-118: Search the file overview by title, names and content
Date: 2026-11-06 · Tests run: `npx vitest run "src/app/(team)/team/dateien" src/platform/migrations.integration.test.ts` → 11 files, 88 tests passed, 0 failed · Preview: none
(`e2e/file-overview.spec.ts` was not run by me: port 3100 is held by the verify run in the background. It still needs a green run there. `check-scenarios.ts`: 10/10 scenarios covered.)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A file is found by its own data and by what it is attached to (outline, 4 examples) | file-overview.integration.test.ts | Yes. Original file name, machine and Eight Ball set up. Loops over all four literal examples, expecting exactly `["MM Operations Manual"]`. Goes through the page data function and renders the view. | pass |
| A file is found by the content of its indexed passages | same | Yes. The passage is stored by the real support helper and the generated column does the rest. Asserts "Spule" lists the file, the index state is unchanged and OpenRouter requests are `[]`. The "indexed before this search" half is proven by the migration test (0046, the 0045 schema with the data inserted before the migration). | pass |
| Every word must be found, not all in the same place | same | Yes. Literals "Medieval Spule", only "Service guide" listed. | pass |
| A word in a file's own data comes before the same word in the content only | same | Yes. Older "Coil chart" and newer "Service guide" with explicit clock times, so newest-first alone would give the opposite order. The "page 340" detail is only in the passage text, which is fine. | pass |
| The page says that only the content of indexed files is searched | same | Mostly. Real indexing run for A, B added after the run, and the sentence is asserted. Weakness: "C failed" is only a mp4 and the test never asserts that C failed. C does not hold "Relais" either, so the "would mention" part is not really set up. The outcome (only A) is still right. | pass, weak Given |
| A scanned PDF is not found by its content | same | Partly. A scan with no text layer is modelled as an indexed file whose only passage has other text. This is a fair stand-in, because the search only sees stored passages. It does not go through the PDF reader. Both searches are asserted with literals. | pass |
| Content stays searchable while AI is off | same | Yes. Key removed, "Spule" finds the file, the AI index state text is absent, no requests. Second half: a file indexed with `another/embedding-model` while AI is on is found. The "while another model is indexing it again" is modelled as a separate file with a foreign model, not the same file in the `waiting` state. | pass |
| Search, filters and pages work together | same (+ e2e "without JavaScript" case) | Yes. 30+5+10 files, "Relais" with "Handbuch", "30 Dateien · Seite 2 von 2", 5 listed, the "Weiter" and "Zurück" addresses, the hidden fields, no `page` field, query object. "Without JavaScript" is covered by the plain GET form and the e2e spec, which I could not run. | pass |
| A corrected name is found at once and a removed file no longer | same | Yes. Real `correctMachineModelCommand` and `removeFileCommandWithAiIndex`, with a before and after check. | pass |
| Nothing found says so and keeps the words | same | Yes. Text, "Alle Dateien anzeigen" href and the filled-in field are all asserted. | pass |

Extra tests: `search-words.test.ts` (words, limits, address, strict origin), "an empty search ... is no search", migration test 0046.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px usable | yes | The form is `flex-col`, with the field and button in a row. The e2e spec (not run by me) asserts `scrollWidth <= 360`. | OK pending e2e run |
| Texts from the catalog | yes | All new strings are in `platform/messages/team/collection.ts` (`searchForm`, `search`, `searchSubmit`, `searchHint`, `nothingFoundSearch`). The tsx has no literals. | OK |
| Module boundaries | yes | Collection's `file-overview.ts` has no AI import. AI assistance's `files-containing-words.ts` does not know the overview. The page merges in memory (`search-order.ts`), with no join across tables. The service is exported through `index.ts`. | OK |
| No JavaScript / G32 / G40 | yes | GET forms, hidden fields (`KeptFields`), no page in the forms. | OK |
| Journal entry per command | no | Read-only. The generated column is never journaled (data-model note). | n/a |
| No personal data in logs | yes | The search words are not logged. | OK |
| Performance with realistic data | yes | A GIN index on `words`. Collection computes the ts-vector per row over all non-removed files with subselects (a few hundred files, accepted in the doc). | OK (note below) |
| Docs | yes | data-model.md and conventions.md were updated. Migration 0046 and its snapshot are present. | OK |
| Advisories | no | No dependency change. | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Words that are stop words in both German and English (e.g. "in", "on", "to"): I checked the database, and `plainto_tsquery` gives an empty query, which matches nothing. So "Spule in" finds nothing, and a search for "in" alone says "nothing found". A word like "die"/"the"/"für" is kept, because one of the two configs keeps it. | Story: "every word must be found". The search words do not drop stop words. | Question or small fix: drop words with an empty query from the required words (and treat a search of only such words as no search), or at least document it. Not a violation of a written rule. |
| Umlauts and ß: "Gehause" finds "Gehäuse" (German stemming folds them). "ueber" does not find "über". | none | Fine. Mention in the test plan. |
| Very long input: cut to 200 characters, at most 8 words, 40 characters per word, with a unit test. A cut search is then in the address as the cut text. | Not in the story. | Fine, but the story does not say it. Note it. |
| Search plus the AI state filter (`aiIndex`) | Not stated. Code: the search narrows `found`, the AI state is then computed for the remaining ids, and the hidden fields carry `aiIndex`. | No test combines "search" with "aiIndex". Recommend one small test (new story or a follow-up commit). |
| The origin `files:` of the details page carries `search`: `strictFileOverviewQueryOf` accepts and round-trips a search, and the link is `fileDetailsAddress(entry.id, { files: query })`. | G17 (closed list) | There is only a unit test of the query parser. No test checks that the details page link `from=files:search=...` takes you back to the search, or the encoding of `&` and `=` inside `from`. Recommend a test. |
| Retired machine | Story: "a retired machine's too" | The SQL has no filter on a retired status, so it fits. There is no test with a retired machine in the search (only the migration test keeps the attachment). Recommend adding a test. |
| Both lists in one SQL with `ts_rank` on very different texts | Story: ranks never added up, and they are not (own sum, content sum). Within a tier, ranks are summed across words (intended). | OK |
| Many words (8) × per-row ts-vector over all files | Not stated | Fine at a few hundred files. Watch it as the number of files grows. |
| Failed or `waiting` entry with a leftover passage from an old model: the AI query reads only `state = indexed`, so a file waiting for the new model is not found by its content. | Story Notes say a file waiting for the current model while holding older entries is still found (the "small imprecision"). | Unclear: the code requires `state = indexed`. How a re-indexing file looks (indexed, with the old model, vs `waiting`) depends on the entry's state model. The test covers only a separate file with a foreign model, so this claim is not proven for one and the same file. Question to the owner. |

## Verdict
accepted with remarks

All 10 scenarios have a titled test that checks the Given, When and Then with literals, the run is green (88/88) and the module boundaries hold. Remarks: (1) the e2e spec was not run by me and must pass in the background verify; (2) the scenario "The page says that only the content of indexed files is searched" has a thin setup (C does not fail, and does not hold the word); (3) two-language stop words such as "in" make a search find nothing; (4) no tests for search with `aiIndex`, for the `files:` origin carrying `search`, for a retired machine, or for one and the same file being re-indexed with a new model.

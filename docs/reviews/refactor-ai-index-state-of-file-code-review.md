# Code review – refactor-ai-index-state-of-file (candidate 4, architecture review 2026-11-01)
Base: main · Commits: 1 · Date: 2026-11-02

No story: a refactoring meant to be behaviour-neutral. `aiIndexStatesOfFiles` answers waiting, indexed or failed; the kind's `waiting` and `isWaiting`, `aiIndexOverview` and `filesTheAiCannotRead` read it.

**Result: no behaviour difference at any size this museum can reach.** The only new limit is theoretical (#2). I reran the two affected integration test files (27 passed) and relied on the reported verify and browser results. I changed nothing, so no mutation was run: "pinned by a test" below comes from reading the tests.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Documentation | `docs/engineering/conventions.md:831-832` | The new text says a join over both modules' tables "would cross the module boundary (ADR 0002)". ADR 0002 does not say that: its line 17 says read models "may read across modules". The rule that does forbid it is in the conventions (*Reading across modules – the page composes*: "no database view across modules", "Don't import another module's `schema.ts`"; *Import rules*) and the context map (Collection publishes narrow queries). The decision is right, but the citation points a future reader at a sentence that argues the opposite. | ADR 0002 line 17; conventions lines 44-51, 853-859; context map *Collection → AI assistance* | Cite the conventions section and the context map instead of ADR 0002, or name both and say the conventions narrow it. |
| 2 | minor | Behaviour at scale | `src/modules/ai-assistance/ai-index-entries.ts:95` | `inArray` binds one parameter per ID (`drizzle-orm` `conditions.js:78`). `waiting` and the overview pass every file, so they would fail above PostgreSQL's limit of 65,535 parameters; on main they read by model alone and had no such limit. `waiting` also runs before every piece a run takes, so the statement grows with the number of files. ADR 0002 sizes the museum at ~60 machines, so this is not reachable in practice. | Behaviour-neutral goal; ADR 0002 *Context* | Accept it, and change nothing unless the file count grows by orders of magnitude. The direction then is one array parameter (`= ANY`). |
| 3 | minor | Speculative Generality | `src/modules/ai-assistance/ai-index-entries.ts:77`, `:101` | `{ state: "indexed"; version }`: no reader uses the version of an indexed file. Only the failed state's version is read (the overview, for „Erneut versuchen“). The new test is the only other place that sees it. | Smell *Speculative Generality*; codebase-design: small interface | Make it `{ state: "indexed" }`; the entry's `version` column stays selected for failed files. |
| 4 | minor | Design / naming | `src/modules/ai-assistance/ai-index-overview.ts:54-64`, `src/modules/ai-assistance/file-indexing-work.ts:31`, `:39` | The result holds an answer for every ID given, but neither the type nor the comment says so. Each reader therefore handles an `undefined` that cannot occur, each differently: the overview counts it as waiting (its final `else`), `waiting` drops it, `isWaiting` answers false. Harmless today, but the module's interface leaves its main guarantee unstated, which works against "the one answer". In the overview the state is also still named `entry`, though a waiting file has none. | codebase-design: interface includes invariants; smell *Mysterious Name* | State in the doc comment that every given ID has an answer. Name the overview's variable `state`. The main session decides whether a total accessor is worth it. |
| 5 | minor | Test quality | `src/modules/ai-assistance/file-indexing-work.ts:29-31` | `AiWorkKind.waiting` promises "the order to take them" (oldest file first). The new code keeps it by construction: it filters the array that `filesForIndexing` sorted. I found no test that pins this order in `file-indexing.integration.test.ts` or `ai-work.integration.test.ts`, and no test calls `waiting` directly. The gap is older than this branch, but this branch rewrote the line. The order of `failed` is pinned (`ai-index-overview.integration.test.ts:177`). | tdd: interface as test surface; `src/modules/ai-assistance/ai-work.ts:50` | One test at the run's seam: two files, the first attached is embedded first. |
| 6 | minor | Test quality | `src/modules/ai-assistance/file-indexing.integration.test.ts:578-579`, `:596-597` | `version: expect.any(Number)` accepts any number, although a first entry's version is known: the ST-109 test asserts `version: 0`. `otherEmbedding` is added to the models the AI stand-in offers, yet the query only needs its ID, so the setup suggests a dependency that does not exist. Otherwise the test is sound: data comes through commands, it sits at the read-model seam of the catalog, and it checks both the other model and the empty case. | tdd: expected values from a known source; seam catalog *Read model* | Assert `version: 0` for the failed file (and drop it for indexed with #3). Use a plain model ID string. |

## The deliberate decision: not computed in SQL

**The decision is right, and I see no better way inside the module boundary.**

- **Why one statement is ruled out:** `file.removed_at` decides which files count, and only Collection may read it. The conventions rule out both a join and a database view across modules. The one documented exception (Maintenance's lists, conventions line 349) still goes through the upstream's published query, so it is no precedent for reading a table.
- **Alternatives considered:**
  - A Collection query that takes AI index input would make Collection aware of AI, which the context map forbids.
  - An optional `fileIds` that reads the whole model would bring back the widened interface `entriesFor` had. It would only remove #2, which is not reachable.
- **What was lost compared with the plan:**
  - The counts are not computed by the database.
  - The answer is not one snapshot.
  - Neither is a loss compared with main: main also loaded every file in code and read files and entries in separate statements. The candidate's real goal, one answer in one place, is met.
- **Still open:** the plan's words "computed in SQL" remain in the session's memory note on this review. The conventions now record the real decision, once #1 corrects the citation.

## Behaviour checked, no difference found

| Question | Result |
|---|---|
| `waiting`: order | Same. It filters the `asc(attachedAt)` result of `filesForIndexing`; the order of the entry rows plays no part. |
| `waiting`: no files | `[]`, with one query fewer (guard at `ai-index-entries.ts:86`). |
| `waiting`: extra columns | Small scalar columns only; the embeddings are on `ai_index_item`. The cost is negligible. |
| `waiting`: failed file with the current model | Still not waiting (HS-32). A failed entry is not `waiting`, as it was "known" on main. |
| Parallel to sequential reads | No new outcome. Each read was its own statement on main as well, with no shared snapshot. Files are now always read before entries, so an entry stored before the file list was read is always seen. This adds one round trip per call, which is negligible next to an OpenRouter request. |
| `isWaiting` | The same order (AI state, entry, file), all on `tx`, and the file is still not read once an entry exists. `id in ($1)` matches the same row as `id = $1`. |
| Overview: counts and order of `failed` | Same loop over the same files; `failed` keeps file order. |
| Overview: entry of another model | Filtered in SQL as before, so the file counts as waiting. Pinned by ST-110 (`ai-settings-change.integration.test.ts:203`, `:208`, `:231`). |
| Overview: entry of a removed file | Not counted: the loop runs over the files that are not removed, as on main. The removal policy also takes the entry in the same step. |
| `filesTheAiCannotRead`: empty | Still answers before reading AI settings (`ai-index-overview.ts:78`). |
| `filesTheAiCannotRead`: duplicates | Same result. The `Map` keeps one key, the `Set` one ID, and insertion order is unchanged. |
| `hasAiIndexEntry` | The same query for any model; dropping the `and` around one condition changes nothing. `file-removal.integration.test.ts:99` and `:182` cover both answers. |
| `failureReason!` | Moved, not new. The comment is correct: `drizzle/0042_yellow_bushwacker.sql:7-8` requires a reason when failed and none when indexed. |
| Boundaries | `ai-index-entries.ts` reads only its own table. `aiIndexStatesOfFiles` is not exported from `index.ts`. |
| Language | `check-language.ts` adds no new word: its warnings on these files are the known `ai` hits (`aiNow`, `AiDependencies`, `filesTheAiCannotRead`). |
| Removed functions | No code or current doc names them. Only `docs/reviews/ST-106-code-review.md` does, and that is a historical record. |
| Conventions text | Accurate apart from #1. "None of them looks at an entry's model or state" holds for the four readers it names. `ai-index-search.ts`, `embedding-model-change.ts` and the retry decision (`ai-index-entry.ts:219`) still read them, but they ask other questions, and the text does not claim otherwise. |

ready to merge
Most important: the new conventions text cites ADR 0002 for a rule that ADR actually loosens (#1); the code itself shows no reachable behaviour difference.

## Resolution (main session, 2026-11-02)

| # | Outcome |
|---|---|
| 1 | **fixed** – the conventions name *Reading across modules – the page composes* instead of ADR 0002. |
| 2 | no change – accepted: one parameter per ID reaches PostgreSQL's limit only at 65,535 files, and ADR 0002 sizes the museum at about 60 machines. |
| 3 | **fixed** – the indexed state carries no version. |
| 4 | **fixed** – the answer is a function by file, so a file without an entry is waiting and no reader handles `undefined`; the overview's variable is `inIndex`. |
| 5 | skipped – the gap predates this branch and the order is unchanged. |
| 6 | **fixed** – the test expects `version: 0` and uses the other model by its ID only. |

# Code review – refactor-file-overview-pipeline: the file overview's pipeline in one module, word search in one place
Base: HEAD~1 (1078247) · Commits: 1 · Date: 2026-11-07

Behaviour-neutral refactoring (architecture review 2026-11-06, item 3). Here is what I checked and found to be neutral:

- The `wordsOfText` SQL is byte-identical to HEAD~1. The only change is the parameter type, `ReturnType<typeof sql>` → `SQL`, which is the same type. So the generated column `ai_index_item.words` is unchanged.
- Collection's `ownText` is a `||` chain of `coalesce(…, '')` terms, so it is never NULL. The extra outer `coalesce` that `wordsOfText` adds changes nothing.
- `aiIndexStates: stateOf` gives the same result as the old `aiOn` check. `stateOf` is `undefined` exactly when `!aiOn`. The one theoretical difference is that `stateOf` can come from the second `aiIndexStatesForOverview` call. If AI were switched off between the two calls, the filter options would now follow the second reading. That reading also decides the per-line state, so the page stays consistent with itself. No finding.
- `src/platform/word-search.ts` imports only `drizzle-orm`, so platform still imports no module. Collection and AI assistance now share platform code instead of copying SQL, which is allowed.
- Typecheck passes, `search-order.test.ts` passes (8 tests), and `check-language.ts` reports no new warnings in the changed files.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Test quality | src/app/(team)/team/dateien/search-order.test.ts:60 | The test "never adds the two ranks up" does not pin the rule. Its two files differ in how many words their own text holds (1 vs 0), so the first sort key decides the order. An implementation that sorts by own-word count and then by `ownRank + contentRank` would still pass. | tdd skill (a test that does not check its "Then"); conventions.md "the ranks are never added up" | Use two files with the same own-word count. Give the file with the lower own rank a content rank high enough that a sum would put it first (e.g. `a: [0.1, null]` + content 0.9 vs `b: [0.2, null]` + content 0.1 → `b` first). |
| 2 | minor | Docs | docs/engineering/conventions.md:436 | The changed paragraph still says "`wordsOfText` in `schema.ts`". Four lines later it says the function lives in `src/platform/word-search.ts`. | Stale comment / documentation | Change it to "`wordsOfText`, `src/platform/word-search.ts`" or drop the location there. |
| 3 | minor | Code smell | src/app/(team)/team/dateien/file-overview-pipeline.ts:15 | `AiIndexState` spells out `"indexed" \| "waiting" \| "failed"` again. AI assistance already exports this union as `AiIndexStateOfFile["state"]`. Before this commit the same union was written inline in `lineOf`, so this is not a regression, but now that the union has a name it is a second source. | Duplicated Code; ADR 0002 (the module owns its vocabulary) | Write `export type AiIndexState = AiIndexStateOfFile["state"]`. |

Verdict: ready to merge
Most important finding: #1 – the "never adds the ranks up" test passes by the first sort key, so the documented no-sum rule is not actually pinned.

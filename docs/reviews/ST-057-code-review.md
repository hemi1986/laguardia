# Code review – ST-057: Number of overdue maintenance tasks in the machine overview
Base: main · Commits: 4 · Date: 2026-10-25

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | major | Test quality | `src/app/(team)/team/machines/machine-overview.integration.test.ts:242-269` | In both scenarios every due task is also overdue (start 2026-01-01, interval 3 months, clock 2026-10-04). So if the `machine.overdue` filter in `overdueMaintenanceCounts` were dropped, every test would still pass. Nothing pins the boundary the story draws under Out of Scope ("Due (not yet overdue) tasks in the overview"): a task that is due but not overdue must not count. | tdd skill (scenario test does not guard the rule it relies on); story Out of Scope | Add one more task to the first scenario that is due but not yet overdue on LG-042 on 2026-10-04 (e.g. a start date so the due date falls a few days before the clock). LG-042 must still say „2 Wartungsaufgaben überfällig“. That is a few lines in the existing test. |
| 2 | minor | Scope | `src/app/(team)/team/machines/stickers/*`, `[museumNumber]/datei-anhaengen/attach-file-form.ts`, `machine-overview.test.ts:46-52` | Commit f05d1a3 reformats files the story doesn't touch (Prettier: main had these files unformatted). This is harmless, but it hides the feature change in the diff. | Scope / Divergent Change in one commit | Next time, put formatter catch-up in a separate commit on the branch. Nothing to change now. |
| 3 | minor | Naming / docs | `src/app/(team)/team/machines/machine-overview.integration.test.ts:23-26` | The file's header comment still describes the data as "Collection's machines with Repair's number of open defects per machine". It now also composes Maintenance's overdue counts. | Mysterious Name (stale comment) | Add Maintenance's number of overdue maintenance tasks to the header. |
| 4 | minor | Naming / docs | `src/app/(team)/team/machines/machine-overview.tsx:155-157` | The JSDoc was re-wrapped by hand and now breaks after "its machine", leaving "record (ST-009)." alone on a line. | Cosmetic | Re-flow the comment. |

Checked without findings:
- ADR 0002: the module seams hold. The page data function composes Maintenance's public `overdueMaintenanceCounts` next to Repair's `openDefectCounts`. Maintenance reads Collection's machines itself, as the documented exception allows. Overdue is computed on read with the injected clock (`systemClock` on the page, `fixedClock` in tests), and there is no `new Date()`.
- The `RM-MachineOverview` field is named in the query's doc comment.
- Not-on-display and retired machines get no count, because `machinesForMaintenance` and `dueOn` already exclude them.
- Language: the UI texts use „Wartungsaufgabe“ / „überfällig“ (glossary _UI (de)_). `check-language.ts` reports nothing in the diff.
- Security: no input, no commands, no visitor page.
- Both scenario tests exist with their exact titles. They go through the page data function plus the rendered view (the seam catalog's "page composed from several modules"). The expected texts are independent literals, and both tests pass.

Verdict: ready to merge (no blockers)
Most important finding: #1 – no test would notice if due-but-not-overdue tasks were counted; add one due-only task to the first scenario.

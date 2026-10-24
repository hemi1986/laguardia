# Code review – architecture review 2026-10-25, candidate 2: one window and one mark line for both dashboards
Base: main · Branch: arch-dashboard-changes · Commits: 1 · Date: 2026-10-25

Refactoring, no story. Reviewed against ADR 0002 (module boundaries, read models are queries), ADR 0011 (the Last
visit), ST-050, ST-058, ST-086, the engineering conventions (`.claude/skills/engineering-conventions/SKILL.md`),
`CONTEXT.md` and the tdd / codebase-design skills. `check-language.ts`: no warning in a changed file.

## Questions from the hand-off, answered

**Behaviour equivalence, technician dashboard.** Identical. `recentSince(clock, marks)` computes
`earlierOf(hoursBefore(now, 168), marks.lastVisit)` exactly as the removed inline code did, and
`reachedBack = since < lastSevenDays` is the removed `recentSinceLastVisit` expression. `markLineOf` is still awaited
before the parallel round, as before, because `since` depends on it.

**Behaviour equivalence, helper dashboard.** Equivalent. Before, `changesOnClaimedDefects` read `clock.now()` itself
inside the parallel round. Now `recentSince(clock)` reads it synchronously just before the round. With `fixedClock` in
the tests it is the same instant. With the system clock it is the same tick in practice. Both `since` uses in the query
(the journal filter on leaving entries and the final `leftAt < since` cut) get the same instant, so the 7 × 24 h
boundary of the ST-086 scenario "A defect that left her stays listed for 7 days" holds, and the test still covers it at
±1 h. The helper passes no mark line, so it keeps exactly 7 days whatever the Last visit is (the user's decision).

**One parallel round.** Kept. The helper's five reads (`markLineOf`, both `openDefects`, due maintenance,
`changesOnClaimedDefects`) are still one `Promise.all`. `recentSince` is synchronous and adds no round trip.

**Module boundaries.** Clean. `new-since-last-visit.ts` imports `lastVisitOf` from `@/modules/team`, the public index
(ADR 0002, ESLint boundary rule). This import is not new for the app layer: both data files had it before, so the
number of app files importing Team went from two to one. Repair now depends on neither `Clock` nor `platform/time` for
this query, and the window lives with the only callers that know what it means (ST-086: "the same window as on the
technician dashboard"). That is a locality gain.

**Is anything half-done or misleading?** Leaving the two items out is sound and does not leave a broken half. The
helper's journal replay is the only place that knows whether a resolution ended *her* claim. The own-actions rules mean
different things (the helper's list leaves them out, the technician's shows them unmarked), and `helper-dashboard-data.ts:80`
already says so in a comment. The "resolved" deferral is recorded only in the commit message (see #4). The other
points of attention are the wording and the test gap below.

**Depth.** `markLineOf` is one line, but it passes the deletion test: remove it and the `{ viewer, lastVisit }`
construction and the Team import come back in both data files. `recentSince` puts the 168 h constant, the reach-back
rule and the "reached back" flag behind one call. Both are fine.

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Test quality | `src/app/(team)/team/helper-dashboard-data.ts:57` | The user's decision that the helper dashboard does **not** reach back to the Last visit is not pinned by any test. Every helper test either records no visit (`lastVisitOf` is then *now*, so passing the mark line would change nothing) or keeps the Last visit within 7 days. Since the interface now makes reaching back a one-argument change (`recentSince(clock, marks)`), a later edit could break the decision with every test still green. | tdd skill ("a scenario's Then actually checked"); user decision 2026-10-25 (ST-086 is done, behaviour unchanged) | Add one integration test at the existing seam (`loadHelperDashboard` through the page HTML, as in `helper-dashboard-changes.integration.test.ts`): Last visit 10 days ago, a defect taken over 8 days ago, and assert it is not listed. Title it as a user decision, not as an `ST-086:` scenario. About 15 minutes, so do it in this PR. |
| 2 | minor | Conventions text | `.claude/skills/engineering-conventions/SKILL.md:465-468` | "Its recent changes start at `recentSince(clock, marks?)`" overstates the rule for the helper dashboard. There only the defects that *left* her are cut at that instant. The changes on a defect she still claims go back to her claim (ST-086), however old. The text also calls the parameter `marks?` while the code calls it `backTo?` (`new-since-last-visit.ts:33`), and line 468 runs past the wrap width the rest of the section keeps. | conventions are the reference for later stories; Mysterious Name (parameter mismatch) | Say what the instant bounds: "the technician dashboard's recent changes, and how long a defect that left the helper stays listed, start at `recentSince(…)`". Use one parameter name in both places (`backTo` reads well) and rewrap the paragraph. |
| 3 | minor | Design / comment | `src/modules/repair/claimed-defect-changes.ts:48-50` | The module doc now says "since `since` (the dashboard's window)": a Repair query that names its caller's concept. It is harmless, but the point of the change was that Repair no longer knows the window. That doc line, and the `ClaimedDefectChanges` doc at line 20, also run past the wrap width. | ADR 0002 (a module states its own interface, not its callers'); codebase-design (interface = what a caller must know) | Drop the parenthesis ("a defect that left them at or after `since`") and rewrap both comments. |
| 4 | minor | Scope record | (commit message only) | The two deliberate omissions are written down only in the commit message: the single source for "resolved" (moved to the deferred candidate 4) and the different own-actions rule. Whoever picks up candidate 4 has to find them in the git log. | CLAUDE.md "Don't guess" (keep what is open findable); locality | Note the "resolved" duplication where candidate 4 is tracked (the architecture-review notes), or add a one-line comment at the helper's replay, `claimed-defect-changes.ts`, on `EVT-DefectResolved`. Nothing else is needed. |

No blocker, no major, no follow-up. Nothing passes the follow-up hurdle: none of these is a security or data-loss risk, and each can be fixed in this PR in minutes.

ready to merge
Most important: #1. No test pins the helper dashboard's "no reach-back" decision, and the new `recentSince` interface makes it a one-argument change.

## Resolutions (2026-10-25)

| # | Resolution |
|---|---|
| 1 | Fixed: "does not reach back to the Last visit – a defect that left him 8 days ago is gone though he was last here 10 days ago (user, 2026-10-25)" in `helper-dashboard-changes.integration.test.ts`; checked to fail when the helper dashboard passes its mark line. |
| 2 | Fixed: the conventions say what the window means on each dashboard, name the parameter `backTo?`, and are wrapped. |
| 3 | Fixed: Repair's comment no longer names the dashboard; the type's doc is wrapped. |
| 4 | Fixed: a comment at the `EVT-DefectResolved` case says why it reads the journal, and the deferral is recorded with candidate 4 in the review plan. |

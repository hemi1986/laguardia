# Acceptance – ST-051: Repair times view
Date: 2026-10-25 · Tests run: `npm test -- -t "ST-051"` → 17 passed, 0 failed (3 files); `npx playwright test e2e/repair-times.spec.ts` → 2 passed · Preview: none (checked against code and local tests)

Traceability: `check-scenarios.ts ST-051` → 18/18 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Median times per priority | repair-times page test | Three high defects with 1/2/6 and 3/5/10 days set up through commands; both literal strings asserted | pass |
| Median of an even number | repair-times page test | 2 and 5 days, literal „Bis behoben: 3,5 Tage · 2 Defekte“ | pass |
| Current priority counts | module test | Recorded normal, prioritized high, resolved; asserts it is in high and absent from normal. Counts "for priority high" via the read model, not the page text – adequate | pass |
| Both times in the defect details | defect-details test | Real page render, literal 1,5 / 4,0 line | pass |
| Earliest problem report counts | defect-details test | Linked earlier report (8 June) after recording (10 June), literal „3,0 Tage“ | pass |
| Switch to 90 days | page test | 60 days ago; 90 shows 10,0 Tage · 1 Defekt, 30 shows „Keine Defekte“ (the "back to 30" part is covered) | pass |
| Period counted in elapsed hours | module test | ±1 hour around 30 days; distinguished by typical value (10 d 1 h vs 9 d 23 h), so the right one is proven | pass |
| Closed on retirement not resolved | module test | Real retire command; asserts toResolved undefined, work log time still counted | pass |
| Without work log entries | module test | toFirstWorkLogEntry undefined, toResolved counted | pass |
| Latest resolution after reopen | module test | Dates from the scenario (1/3/5/9 June), clock fixed, 8 days literal | pass |
| Reopened defect not counted while open | page test | Asserts section has no times and defect page has no „Bis behoben“; the scenario's "resolved 10 days ago / reopened 5 days ago" matches | pass |
| First work log entry stays first | defect-details test | Dates from scenario, literal „1,0 Tage“ | pass |
| Period membership | module test | 40/35/10 days; resolved counts (30 d), first work log not in 30 days (and counts in 90 days) | pass |
| Time without defects says so | page test | Literal first-entry line with 1 Defekt and „kein Defekt in diesem Zeitraum“ | pass |
| Priority without defects says so | page test | „Keine Defekte…“ and neither time label in the low section | pass |
| Explains without the word median | page test | Both sentences literal, `not /median/i` on the whole HTML | pass |
| Technicians reach it from navigation | e2e (local only) | Order after „Wartungsplan“ via list texts, link click, 30 days preselected (aria-current), 360 px width | pass |
| Helpers cannot open it | e2e (local only) | Helper does not see the link and `/team/repair-times` redirects to `/team` | pass |

The two navigation scenarios run only locally (no technician account on a preview); CI will skip them. Run them on the preview by hand or accept the local run.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts page width <= 360 on the repair times page; the period choice wraps (flex-wrap); the technician navigation is shared | OK |
| List pages fast with realistic data | partly | `repairTimes()` selects every defect with three correlated subqueries and filters/sorts in JavaScript; fine for a museum's defect count, no volume test | remark |
| Every command writes its journal entry | no | read model only, no command | n/a |
| Texts from message catalogs | yes | `repairTexts.repairTimes`, `terms`, `team.repairTimes`; no inline German in components | OK |
| No personal data in logs | yes | nothing logged | OK |
| Critical advisories | not this story | – | n/a |
| Role check at page and module (G11) | yes | page calls `requireTechnician()`; e2e proves the redirect. `repairTimes()` itself has no role check, but it is a read model that takes no actor, so there is nothing to check | OK |
| No "Median" in the UI; glossary terms | yes | tested; code comments say "typical" per CONTEXT.md | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Defect resolved, reopened, resolved again in different periods: counts only with its latest resolution | Story context: "latest resolution counts" – implemented (max of resolutions, only while state is resolved) | none |
| Defect resolved before its earliest linked report (negative time) | Not stated; cannot happen via commands as far as seen | question, low priority |
| A defect whose priority was changed while resolved is grouped by current priority | Story: "Grouping uses the defect's current priority" | none |
| Defect on a retired machine that was resolved earlier and then closed | A resolved defect is not closed on retirement; counts as resolved | none |
| Resolved-then-reopened defect that is later closed on retirement: no time to resolved | Story: closed on retirement is not resolved | none |
| Very long period / many defects: all defects loaded and computed in memory | DoD "list pages fast" | line in review only (no named story depends on it) |
| Single defect word: "1 Defekt" singular is used though the scenario text uses only plural | G6 | fine |
| Days with durations over 999: German thousands separator (e.g. „1.000,0 Tage“) | G13 | fine, cosmetic |
| Unknown `?zeitraum=` value falls back to 30 days | G20 preselection | tested |
| Period chosen by link (no JavaScript); the story says "choice", not a control type | UX G20 | fine |
| Time-of-day: "the moment the view is opened" – page is rendered per request with `systemClock`; confirm the page is not statically cached (it reads `searchParams`, so it is dynamic) | Story: elapsed time | none |

## Verdict
accepted with remarks

Remarks (no finding passes the follow-up hurdle):
1. The two navigation scenarios are proved only by the local e2e run; repeat them by hand on the preview deployment when it is available.
2. `repairTimes()` loads all defects without narrowing by period in SQL; fine for the museum's volume, note for later.

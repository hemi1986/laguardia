# Code review – ST-051: Repair times view
Base: main · Commits: 8 · Date: 2026-10-25

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Design / performance | `src/modules/repair/repair-times.ts:79-96` | `repairTimes` loads **every defect ever** and runs three correlated subqueries per defect. Work log and resolution subqueries use the `defect_id` indexes. The problem report subquery (`id = defect.problem_report_id OR triage_defect_id = defect.id`) has no index on `problem_report.triage_defect_id` (see `drizzle/0010_defect.sql`), so each defect scans `problem_report`: cost is defects × problem reports. At museum scale it is fine today: a few hundred defects a year is in the tens to low hundreds of ms. It grows quadratically, though, and the period filter runs in JS after everything is loaded. | ADR 0002 (computed on read is fine), conventions *Read models* ("selects only what the page shows") | Keep only the defects whose first work log entry or latest resolution can fall in the period (`WHERE EXISTS … >= since`). Add an index on `problem_report.triage_defect_id`, or get the earliest report per defect with one grouped join. Under an hour, no new story needed. |
| 2 | minor | Design (Duplicated Code / Shotgun Surgery) | `src/modules/repair/repair-times.ts:26-36, 46-61, 79-96` | The milestones (earliest report, first work log entry, latest resolution only while *resolved*) are derived twice: in SQL for the view and in TS (`defectRepairTimes`) for the defect page. The two share only `timesOf`. The comment on `DefectMilestones` ("what both the view and the defect's page compute them from") claims more than they share. **They agree today** (checked): the report predicate matches `problemReportsOfDefect`, both use `min` of the work log, both use `max` of the resolutions guarded by `state = 'resolved'`. A future way of attaching a report to a defect, or a new end state, must still change both places. | codebase-design (locality), smell: Duplicated Code | Derive the milestones in one place. For example, the view's query takes an optional defect ID and `defectDetails` asks it. Or keep both and add one test that checks a defect gets the same two times on both pages (the reopen test does this only for "no time to resolved"). |
| 3 | minor | Interface | `src/modules/repair/index.ts:93` | `defectRepairTimes` is exported from Repair's public interface, but only `defects.ts` uses it, from inside the module. The page gets the times through `defectDetails`. | conventions *Module layout* (index.ts = public interface), smell: Speculative Generality | Drop it from `index.ts`. |
| 4 | minor | Dead text | `src/platform/messages/team/repair.ts:135` | `repairTexts.repairTimes.title` is never used. The page takes its title from `teamMessages.terms["Repair times"]`. | smell: Speculative Generality | Remove the key, or have the page use it. Not both. |
| 5 | minor | Placement (Primitive Obsession, mild) | `src/platform/messages/team/repair.ts:348-354` | The duration formatter `daysOf` (G13: one decimal, German format) and its own `DAY_MS` sit at the bottom of the Repair catalogue. Durations travel as bare milliseconds, with another day constant in each test. Showing a time otherwise goes through `time.ts` (`formatDateTime`). | conventions *Time and time-based rules* ("showing a time" row) | Move it to `src/platform/time.ts` as a `formatDays(milliseconds)` next to `formatDateTime`, with a small table test, and give the conventions table a row. Only if a second page needs it; otherwise leave this as a line here. |
| 6 | minor | Conventions | `.claude/skills/engineering-conventions/SKILL.md:552` | The new builder `aDefectWithHistory` (a defect's history step by step, through the commands) and the new `priority` option on `anOpenDefectIn` are not in *Things that exist*. Later stories that need reopened, prioritized or retired defects won't find them there. | conventions *Tests* | Add one line when the conventions are next touched (the user approves that file). |
| 7 | minor | Test quality | `src/modules/repair/repair-times.integration.test.ts:64` | "Defects closed on retirement are not counted as resolved" uses a defect that never had a resolution. It catches an implementation that counts `closed_on_retirement_at` as a resolution, but not one that drops the `state = 'resolved'` guard. That guard is covered only by the reopen-while-open test. | tdd (scenario's "Then" actually checked) | Optional: resolve, reopen, then retire the machine in this scenario's Given, so the guard is exercised for *closed on retirement* too. |

Checked and found in order:
- ADR 0002: the read model is computed on read with the injected clock, and the page passes `systemClock`.
- Module boundaries: imports go only through `@/modules/repair`, plus Collection's public reads in test support.
- `RM-RepairTimes` carries its ID.
- Period: `hoursBefore(now, days × 24)`, inclusive at both ends, pinned by the ±1 h scenario.
- An even count gives the mean of the two middle values.
- Time to resolved only while *resolved*: `CASE` in SQL, the state check in TS.
- Grouping uses the current priority.
- `?zeitraum` is checked against `repairTimePeriods` (anything else is 30).
- `requireTechnician()` on the page, the navigation row only for technicians, the G19 row recorded with its decision.
- No "Median" in the UI, glossary terms in `terms`, and `check-language.ts` finds nothing in the diff.
- The 41 tests of the three touched integration files pass.

**Verdict: ready to merge**
Most important: the view loads every defect with a per-defect scan of `problem_report` (#1). Fine at today's scale, cheap to bound now.

## Resolutions (implementation, 2026-10-25)

| # | Finding | Resolution |
|---|---|---|
| 1 | `repairTimes` loads every defect | Fixed: the query keeps only defects with a work log entry, or a resolution while resolved, since the period began; the exact period rule stays in TypeScript. No index on `problem_report.triage_defect_id` – with the narrowing the subquery runs only for the defects of the period; revisit when the view gets slow. |
| 2 | The derivation lives twice | Fixed by a test: "gives a defect the same times in the view as on its own page" (linked earlier report, reopen, second work log entry, second resolution). |
| 3 | `defectRepairTimes` exported but unused outside | Fixed: no longer exported from `index.ts`. |
| 4 | Unused `repairTimes.title` | Fixed: removed; the page takes the term. |
| 5 | `daysOf` in the catalogue | Skipped: it writes the German UI text („2,5 Tage“), so it belongs to the message catalogue; `time.ts` keeps instants and calendar dates. |
| 6 | Builder missing from the conventions | Fixed: `aDefectWithHistory` and the `priority` option listed under "Things that exist". |
| 7 | Retirement scenario misses the `resolved` guard | Fixed: the defect is resolved and reopened before its machine is retired. |

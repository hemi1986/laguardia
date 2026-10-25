# Code review – architecture review 2026-10-25, candidate 6: confirmations read the latest command once
Base: main · Branch: arch-confirmations-once · Commits: 1 · Date: 2026-10-25

Refactoring, no story. Reviewed against ADR 0002 (module boundaries, the journal is read for answers and never to
rebuild state), UX guideline G3 (a confirmation never comes from the address alone), ST-025, ST-026, ST-030, ST-031,
the engineering conventions (`.claude/skills/engineering-conventions/SKILL.md`), `CONTEXT.md` and the tdd and
codebase-design skills. `check-language.ts`: no warning in a changed file. Tests and e2e were not run (the caller
reports that verify is green with 990 tests, and the browser run happens separately).

## Questions from the hand-off, answered

**Semantic equivalence.** Equivalent. Before, `lastDefectActionBy` called
`lastCommandBy(db, { aggregateId: defectId }, teamMemberId)` with exactly the same target and team member that the page
now uses (`defect.id`, `viewer.id`), under the same guard (`done && viewer`). Then it ran the same `entriesOf(repairEvents, …)`
filter and the same `confirms` loop, which are unchanged in `defectActionIn`. The second read for the reopening had the
same target and team member and was guarded by `confirmed?.action === "reopen" && viewer`. Now it is
`confirmed?.action === "reopen" && command`. `confirmed` can only be defined when `command` is, so the guard is the
same (`&& command` only narrows the type). `reopening && collectionChangesIn(…).statusChangedTo` and the new ternary
both give `undefined` when nothing is confirmed. One real difference, and it is an improvement: before, a command by
someone else could land between the two reads, so the page could confirm the reopening and then drop or mismatch its
status change. Now both answers come from the same command.

**Other pages.** None reads the same target twice. `machine-confirmation.ts` reads at most once per branch, and the
branches return early (file, maintenance record, machine). Its first step, `loadTriageConfirmation`, reads a
*different* target (the problem report) and only when the address asks for a triage outcome. `triage-confirmation.ts`
reads once and asks both `triageOutcomeIn` and `collectionChangesIn` of that one command, which is already the pattern
the conventions now describe. `due-maintenance-data.ts` reads once per maintenance record, and each record is its own
target. `machines/page.tsx`, `machine-models/page.tsx` and `machine-models/[machineModelId]/page.tsx` read once each. After
this change, Maintenance's `maintenancePlanChangedBy` is the only module function that calls `lastCommandBy`.

**The `maintenancePlanChangedBy` exception.** Keep it. The maintenance plan is a singleton aggregate.
`MAINTENANCE_PLAN_ID` is a constant inside `maintenance-plan.ts`, used by the store, the events and the command, and
not exported from the index. A `maintenancePlanChangedIn(command, …)` would make the page take that ID (or an exported
"target") just to pass it back to Maintenance. That leaks an internal and gives the page nothing to do with it. The
plan page asks only Maintenance about that command, so there is no second module to share one read with, and it
already reads once. The deletion test agrees: delete `maintenancePlanChangedBy` and the target, the read and the event
match come back into the page. The `…By` name, as opposed to `…In`, signals the difference correctly. Only the
conventions' stated reason could be sharper (#3).

**Stale names and comments.** `lastDefectActionBy` no longer appears anywhere in `src/` or `.claude/`. Its result type
kept the old name, `LastDefectAction` (#1). One sentence in the conventions that the commit touched still attributes the
read to `readJournal` (#2).

**Conventions accuracy.** The new sentence is accurate. The defect page asks `defectActionIn` and, after a reopening,
`collectionChangesIn` of one command, and `maintenancePlanChangedBy` is indeed the only reader of its own.
`defectActionIn` correctly joined the list of `…In` answers. Dropping the trailing sentence ("the defect page's
`lastDefectActionBy` asks the same latest command") is right, because the new sentence says it better.

**Domain language.** `defectActionIn`, "defect", "command", "reopening", "team member" and "machine status" are all
`CONTEXT.md` terms, and no `_Avoid_` word appears.

**Test quality.** The claim test keeps its assertions: the takeover names the previous claimant, and the claimant's
own read is undefined for someone else. It goes through public interfaces (`@/platform/command`, the Repair index). The
local `lastBy` helper is the same composition the page uses, which is fine at this seam. "For anyone else it says
nothing" is now strictly `lastCommandBy`'s actor rule, which `last-command.integration.test.ts` covers on its own, so
nothing is lost. Reopening with and without a status change is confirmed through `loadDefectDetails` in
`defect-details.integration.test.ts` ("confirms the reopening to who did it – with the machine's new status…", "…without
a status change…"), so the one composition that changed is tested at the page seam. No implementation-coupled or
tautological assertion.

**Depth.** `defectActionIn` is now pure and gets a command (`readonly JournalEntry[]`), like its siblings. The interface
is smaller (no `db`, no team member), and the module still owns which event means which action and what each
confirmation names. This is the right placement of the seam.

## Findings

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Naming / comments | `src/modules/repair/defect-actions.ts:146-157`, `src/modules/repair/index.ts:84`, `src/app/(team)/team/defects/[defectId]/defect-action-pages.ts:1,13` | The function was renamed, but its result type is still `LastDefectAction`, named after the read that left the module. The function now answers "what one command did to the defect". Also, the rewritten doc comment ("What one command did to the defect …") describes the function but sits on the type, so hovering `defectActionIn` shows nothing. The sibling in the same module is named after what is asked (`TriagedInCommand` for `triageOutcomeIn`). | Mysterious Name; local convention (`repair/in-command.ts`) | Rename the type `DefectActionInCommand` (three uses). Split the comment: one line on the type, the rest on `defectActionIn`. |
| 2 | minor | Conventions text | `.claude/skills/engineering-conventions/SKILL.md:208-209` | "read back typed with `readJournal` (`defectActionIn`)". `defectActionIn` does not use `readJournal`. It types the command's entries with `entriesOf(repairEvents, command)`, the way `entriesOf` documents ("typed like `readJournal`'s"). The inaccuracy already existed with `lastDefectActionBy`, but this commit edited the line, so now is the time to fix it. | the conventions are the reference for the next defect action | "…read back typed with `entriesOf(repairEvents, command)` (`defectActionIn`)…". |
| 3 | minor | Conventions text | `.claude/skills/engineering-conventions/SKILL.md:264-265` | "Only `maintenancePlanChangedBy` reads it itself, because the maintenance plan's aggregate ID is Maintenance's". Every aggregate ID belongs to its module, so this reason doesn't explain why this case differs. The actual reasons are that the plan is a singleton whose ID no page knows or should know (`MAINTENANCE_PLAN_ID` is not exported), and that no other module answers about that command. If the next singleton aggregate doesn't get that reason, it could go either way. | Divergent Change risk in the conventions; ADR 0002 (no internals across modules) | "…because the maintenance plan is one aggregate whose ID stays inside Maintenance, and no other module answers about its commands – its `…By` reads and asks in one." |

No blocker, no major, no follow-up. All three can be fixed on this branch in minutes, and none is a security or data
loss risk.

ready to merge
Most important: #1. The result type `LastDefectAction` still carries the name of the read that left Repair, and its doc comment now describes the function, not the type.

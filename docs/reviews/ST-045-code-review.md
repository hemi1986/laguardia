# Code review – ST-045: Record a maintenance task for several machines at once
Base: main · Commits: 5 · Date: 2026-10-24

Checked against ADR 0002 (each item goes through `executeCommand`, so each gets its own transaction, server-side authorization and journal entry; Maintenance reads Collection only through `machinesForMaintenance`/`machineForMaintenance`/`machineLabels`), ADR 0010 (each command takes the retirement lock; the landing page reads with `inCommand: false`), the time convention (`today(clock)`, no `new Date()` in domain code), the decisions approved in the test plan (1)–(5), and the engineering conventions (the runner's `each` step is now documented). IDs are checked (`isId`) before they reach a query, the forged `role` field is ignored (tested), and the confirmation is gated per record by `lastCommandBy` (G3). `check-language.ts` adds no new term. The only warning in the diff is `rejected` in `form-runner.ts`, which is the platform's existing word for a command rejection (`platform/command/errors.ts`) and not the domain term *Dismissed*. Every scenario's "Then" is asserted through the runner, the page loaders and the rendered HTML. Nothing goes beyond the story's scope.

| # | Severity | Area | File:line | Finding | Source (ADR, rule, glossary, smell) | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | minor | Domain / UX | src/app/(team)/team/maintenance/due-maintenance-data.ts:133 | A machine named in `notRecorded` is dropped without a word when Maintenance no longer gives a reason for it, e.g. the task was made suitable for helpers, or a machine model correction made the task apply, between the post and the landing page. The task stays due and nobody is told why, which is the case G23 rules out ("nothing that failed is left out"). Recomputing the reason is the approved decision (3). Hiding the line when there is no current reason is not part of that decision. | UX G23; test-plan decision (3) | When there is no current reason but the label resolves, still show the line, with a neutral text (e.g. "nicht eingetragen – bitte erneut versuchen"), or say in the convention that this case is accepted. |
| 2 | minor | UX / a11y | src/app/(team)/team/maintenance/due-maintenance.tsx:133 | The lines for machines that were not recorded are a plain `text-sm` list, outside any `Rejection`. The form shows the same lines inside `<Rejection>`. G23 calls them "rejection lines". Here they get neither the rejection styling nor the announcement. | UX G23, G8; Duplicated Code (two renderings of one line) | Render the list in `Rejection` (or one shared component that both the form and the list use). |
| 3 | minor | Robustness | src/app/(team)/team/maintenance/mehrere/record-for-several-form.tsx:94 | When every ticked machine is rejected for different reasons and the browser has no JavaScript, the page is rendered again from fresh data. A machine retired meanwhile is no longer in `due`/`others`, so `museumNumberOf.get(item) ?? ""` produces a line without a museum number (" nicht eingetragen: Dieses Gerät ist ausgemustert"). | UX G23 (naming the thing) | Return the museum number with the rejection, or look the labels up for `state.rejected` instead of the offered list. |
| 4 | minor | Robustness | src/app/_actions/form-runner.ts:278 | If one item's command *throws* (not a rejection, e.g. a database error), the loop stops. The items already done stay committed, but the team member sees an error page with no confirmation, and may record them again (duplicate, append-only records). This is no data loss, and a single form behaves the same. | ADR 0002 (one transaction per command – correct); G23 spirit | Leave as is, or catch per item and treat a throw as a rejection with a generic reason so `onSuccess` still confirms what was done. Main session decides. |
| 5 | minor | Robustness | src/app/_actions/form-runner.ts:270 | The number of posted items has no limit. A signed-in team member can post thousands of `machineId` values, and each one runs a transaction one after the other. This is a team-only page, so the risk is low. | Security (input validation) | Cap `chosen` (e.g. at the number of machines, or a fixed limit) and reject anything above it. |
| 6 | minor | Code smell | src/app/(team)/team/maintenance/due-maintenance-data.ts:120,128 | The task name comes from `records[0]` only, and `?? ""` produces „“ an 3 Geräten eingetragen. for a task removed meanwhile. An address with the viewer's own records of different tasks would count them all under one name. This only happens with a hand-made address. | Primitive Obsession / silent fallback | Keep only the records of `filter.maintenanceTaskId` (or of the first record's task), and leave out the confirmation (or use the ST-044 text) when the name is gone. |
| 7 | minor | Duplicated Code | src/modules/maintenance/maintenance-for-several.ts:38,54 | `maintenanceForSeveral` repeats `maintenanceForRecording`'s lookup of the active task and its `today`/`earliest` (LONGEST_BACK_DATING_DAYS) date window. If the date rule changes, both places have to change. | Duplicated Code; Shotgun Surgery | Extract one small "recording window" helper (task + today + earliest) that both use. |
| 8 | minor | Test quality | src/app/(team)/team/maintenance/due-maintenance.integration.test.ts (ST-045: Due machines are preselected…) | The story context says the other machines are listed "sorted by location", but the test has only one other machine, so the order is never checked. It is not a scenario "Then", so this is a gap and not a failing scenario. | tdd (Then coverage); story Context D8 | Add a second applicable machine that is not due, with an earlier location, and assert the order of `others`. |

**Verdict: ready to merge**
Most important: #1 – a machine that failed can disappear from the G23 lines when its reason no longer holds on the landing page. Showing the line anyway is a few lines of change.

## Resolution (implement, 2026-10-24)

Also covers the `/code-review` findings (CR) on the same diff.

Fixed:
- #1 / CR2: a machine that was left out always gets its line. When Maintenance would accept it now, the line reads „LG-043 nicht eingetragen – bitte noch einmal erfassen.“ (test „names a machine left out even when Maintenance would accept it now“).
- #2: the list's lines for machines not recorded now sit inside `Rejection`, as on the form.
- #3 / CR10: a rejected machine that is no longer on the page is named „Ein Gerät“ instead of an empty museum number.
- #4 / CR1: when a command throws after one or more machines were done, the runner logs the error, confirms what was done and names the rest as not run (`EachOutcome.notRun`). If it throws before anything was done, the form fails as before. Tested in `form-runner.integration.test.ts`.
- #6 / CR4: a confirmation without a task name or museum number is not shown, so neither „“ nor „undefined“ can appear.
- #8: the „Weitere Geräte“ sorting by location is tested (row 3 before row 10).
- CR9: the list's address comes from `dueMaintenanceAddress` in the redirect and in the back link.

Skipped minors:
- #5 / CR5 (no limit on posted IDs and address values): only signed-in team members can post or open these pages, and a hall has dozens of machines, not thousands. Revisit if the list is ever opened to visitors.
- #7 / CR7 (task lookup and date window repeated, due list computed for every task): this is a small cost at museum scale. Revisit at the next `/improve-codebase-architecture`.
- CR3 (one ticked machine shows ST-044's text „Wartung an LG-042 eingetragen.“): the text names the machine and is correct; the wording follows the number of records.
- CR6 (one machine load per left-out machine): left-out machines are rare and few.
- CR8 (form-wide rejections found once per machine): the outcome is `required` in the browser, and a rejection is one cheap transaction per machine.
- CR9 (the helpers filter is lost after recording): ST-044's form loses it the same way. Revisit when the filter has to carry through forms.

No follow-ups: none passes the hurdle.

# Acceptance – ST-096: Change a machine's maintenance tasks from its machine record
Date: 2026-10-27 · Tests run: `npm test -- -t "ST-096"` → 13 passed, 0 failed (2 files); `tsc --noEmit` clean; eslint 0 errors · Preview: none (judged from code and tests; browser tests in `e2e/maintenance-plan-machines.spec.ts` read, not run)

## Scenarios
Traceability: `check-scenarios.ts` reports 13/13 covered.

| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A technician ticks a maintenance task for a machine | `change-tasks.integration.test.ts` | Yes. Goes through the form runner with seen/ticked. Fixed clock 10 June. Asserts dueSince "2026-06-10", the 3 tasks, the literal landing text and the other tasks' due dates unchanged. | pass |
| The section says how many tasks apply | same | Yes. The three counts as literals, the button on each section, the link target. | pass |
| The tasks are grouped by interval, the applying ones ticked | same | Yes. The headers in order as literals, no `<details open>`, the name order, the ticked state of 3 tasks, the helper suffix. The h1 is rendered from the message function, not from the page. Minor. | pass |
| Several tasks changed at once, one change per task | `change-tasks-of-machine-command.integration.test.ts` | Yes, at command level. Records stay (count 1), due at once, journal +1 per touched task and +0 for the untouched one, with the added/removed contents. | pass |
| A task removed meanwhile rejects the whole change | page test | Yes. Clean glass still applies (all-or-nothing), the literal rejection text, Wax playfield is not offered, the tick is kept and the group is open. The command-level test backs the all-or-nothing part. | pass |
| A form opened before another change does not undo it | both files | Yes, at both levels. | pass |
| An unknown maintenance task in a forged change rejects it | command test | Yes. A random UUID and a non-ID string, with a known task in the same change: count 0 and no events. | pass |
| Saving without a change is confirmed | page test | Yes. The journal of the plan aggregate is unchanged (the ID is the real `MAINTENANCE_PLAN_ID`, so the check is not vacuous) and the literal confirmation text. | pass |
| Unticking the last task is confirmed in words | page test | Yes. Both literal texts. | pass |
| A machine not on display can get a task | command test | Yes. Count 1, not due on 10 June. | pass |
| A retired machine's tasks cannot be changed | page test and command test | Yes. The button is absent, `machine-retired` also for an unchanged change. | pass |
| An empty maintenance plan says so | page test | Yes. The text, the link to `/team/maintenance-plan`, and no form. | pass |
| Helpers do not change a machine's maintenance tasks | page and command tests, e2e | Yes. No button, the sentence is shown, `not-authorized` for a helper and a visitor, and the e2e redirect. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e asserts `pageWidth <= 360` on the form page | yes (e2e not run here) |
| List pages fast | no | no new list | n/a |
| Command writes its journal entry | yes | events recorded per changed task; the no-change case records none, as the story requires | yes |
| Texts from message catalogs | yes | `src/platform/messages/team/maintenance.ts` | yes |
| No personal data in logs | yes | no logging added | yes |
| Advisories | n/a | no dependency change | n/a |
| Works without JavaScript | yes | e2e "without JavaScript" | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Two technicians save at once on the same machine | Yes (the story: both are stored). Covered by seen/ticked differences and version-free execution. | none |
| Machine record opened for a removed or unknown museum number on the form page | Page shows "unknown" | none |
| Task names with `&`, `(` in e2e selectors | no | none |
| Very long task names in the 360 px layout | no | question (low) |
| Hash of `seen` is a separator-joined string in the form | no rule | none |

## Remarks
- The "several tasks at once" scenario is proven at command level, not through the form. The page-level scenario 1 covers the form path. Acceptable.
- Pre-existing lint warnings only (unused `_` params).

## Verdict: accepted

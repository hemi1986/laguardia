# Acceptance – ST-044: Record maintenance on a machine
Date: 2026-10-15 · Tests run: `npm test -- -t "ST-044"` → 15 passed, 0 failed (3 files); `check-scenarios.ts ST-044` → 11/11 covered · Preview: Vercel branch preview (not clickable as decided: nothing is due there; no browser test, by the decision of 2026-10-15)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Helper records maintenance as done | due-maintenance.integration.test.ts | Given: task due on LG-042, asserted before. When: command as Anna. Then: record (Anna, done, 2026-06-10), not listed, not due 9 July, due 10 July (literals). | pass |
| Recording a task that is not due restarts the interval | due-maintenance.integration.test.ts | Not due on 15 June asserted; second record; not due 1 July / 14 July, due 15 July. | pass |
| Back-dating up to 7 days | record-maintenance-command.integration.test.ts (+ unit test for every day in the window) | Clock 10 June, date 3 June; record date and due 3 July (not on 2 July). | pass |
| No back-dating beyond 7 days | record-maintenance.test.ts | Decision with fixed clock; 2 June rejected with `date-too-early`; boundary covered by the 3 June test. | pass |
| No future dates | record-maintenance.test.ts | 11 June rejected `date-in-the-future`. | pass |
| The date defaults to today | record-maintenance.test.ts | `date: undefined` gives 2026-06-10. | pass |
| Partially done does not reset the interval | due-maintenance.integration.test.ts | Record with the exact note stored; list still shows lastDone 2026-01-01, due since 2026-04-01. | pass |
| Helpers can only record maintenance tasks suitable for helpers | record-maintenance.test.ts (+ form test through the runner, + link only offered to the right role) | Helper rejected, technician accepted; form path also checks nothing is stored and a forged `role` field is ignored. | pass |
| Maintenance task must apply to the machine | record-maintenance.test.ts | Arcade-only task on a pinball machine rejected `maintenance-task-does-not-apply`. Decision level only, per the seam catalog; the command reads the facts from the plan and Collection (covered by the other command tests). | pass |
| Maintenance on a machine not on display counts | record-maintenance-command.integration.test.ts | Real machine with status not-on-display, record stored, interval counts from 10 June. | pass |
| No maintenance on retired machines | record-maintenance.test.ts | Decision with `retired: true` rejected `machine-retired`. Not tested through the command with a really retired machine – see remarks. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes (form, list action) | Single-column form with native date/select and Field components; no browser test at 360 px (by decision, nothing reachable in browser tests). | not verified – see remarks |
| List pages fast with realistic data | yes (due list changed) | `machinesForMaintenance` and records are read in bulk; no per-row queries seen in `due-maintenance-data.ts`. No measurement. | OK (by reading) |
| Every command writes its journal entry | yes | Test "journals the maintenance record on its machine – never its note". | OK |
| Texts from message catalogs | yes | `team.de.ts` (+24 lines), `commandErrorText(teamMessages, …)`; German strings asserted. | OK |
| No personal data in logs / journal | yes | Note is excluded from journal data (asserted). | OK |
| Roles | yes | Visitor gets `not-authorized`; helper/technician rules tested; form page asks `requireTeamMember`. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Retired machine rejection is tested only on the decision, not through the command/Collection fact (`machineForMaintenance` returning `retired`) | Yes ("machine is not retired") | Fix now if cheap: one command-level test with a retired machine. Not a follow-up story. |
| Double submit / two team members recording the same task on the same machine at once creates two records | No rule; records are append-only | Question. Harmless for the interval (latest done wins); the submit button is disabled while pending. |
| Form page for a retired machine or a removed task | Page shows "unknown" with a back link (tested for unknown machine/task; retired inferred from `machineForMaintenance`) | OK, no action |
| Machine/task restricted by technology or category is still shown on the list only where it applies | Yes, by ST-043 | OK |
| Form with 360 px, long notes (no max length visible in the form) | No rule found | Question: is a note length limit wanted? Check the other notes' limits. |
| Task is opened by helper via a hand-typed URL for a non-suitable task | Yes (G11) | Covered: page says why, command rejects. |
| English UI | Team pages are German only | OK |
| Machine "not on display": whether it appears as due | ST-056 | Out of this story. |

## Verdict
accepted with remarks

Remarks (none meets the follow-up hurdle): (1) add the command-level retired-machine test; (2) the form is not verified at 360 px in a browser, which follows with the ST-047 browser test; (3) note length limit is a question.

## Disposition (`/implement`, 2026-10-15)

- **1 fixed** – a command-level test with a really retired machine (`record-maintenance-command.integration.test.ts`).
- **2** – the browser test at 360 px follows with ST-047, as decided.
- **3 (note length)** – a product question for the user at acceptance.
- **4 (two simultaneous records)** – harmless for the interval, as noted; no change.
- Found by the security scan and fixed: the due list page did not pass the signed-in team member, so „Wartung erfassen“ and the confirmation never appeared on the real page.
- Accepted by the user on 2026-10-15: the outcome as a choice in one form (G21 deviation) and no limit on the note length stay as built.

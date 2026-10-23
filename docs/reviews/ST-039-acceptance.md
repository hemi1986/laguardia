# Acceptance – ST-039: Retire a machine, closing its open defects and problem reports
Date: 2026-10-23 · Tests run: `npx vitest run --project integration` on the 6 files with ST-039 tests → 41 passed / 0 failed; `npx playwright test e2e/retire-machine.spec.ts` (local) → 2 passed; `tsc --noEmit` clean; eslint 0 errors · Preview: none (browser specs run locally only)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician retires a machine | retire-machine-command.integration.test.ts | Out of order set up through commands; reason, technician, fixed time asserted as literals; status history and journal asserted | pass |
| Open defects are closed on retirement | retirement-policies.integration.test.ts | on hold + claimed by Tom, resolved "Coin mech jammed"; not in open list, state closed-on-retirement with no resolutions, resolved one unchanged, journal as system | pass |
| Untriaged problem reports are dismissed | retirement-policies.integration.test.ts | reason "machine-retired", not in triage list, system actor | pass |
| Defects closed on retirement are final | retirement-policies.integration.test.ts | reopen, claim, prioritize, log work each rejected, state unchanged | pass |
| Defects closed on retirement are shown as such in the repair history | reparaturhistorie/repair-history.integration.test.ts | "Geschlossen (ausgemustert) am …", no closing note, not "Offen"; resolved one unaffected | pass |
| Actions on a retired machine are rejected | maintenance/record-maintenance-command.integration.test.ts | maintenance, problem report, status change all rejected with machine-retired; journal unchanged (a team member, not a visitor, reports – rule is actor-independent) | pass |
| Retiring asks once and names what it closes | e2e/retire-machine.spec.ts | real page: 1 defect + 2 reports, exact question text, not retired before confirm (second page), confirmation text, 360 px width | pass |
| Going back from the question retires nothing | e2e/retire-machine.spec.ts | status still Spielbereit, defect still open, 2 reports still in triage | pass |
| Machine record of a retired machine shows "retired" in place of the status | machine-record.integration.test.ts | "Ausgemustert" in the Status row, history still has the change to Out of order, not listed in history | pass |
| Problem report at the moment of retirement | retirement-concurrency.integration.test.ts | two real transactions, both orders, via held row lock; rejected resp. dismissed; zero untriaged | pass |
| A reason is required | retirement-policies.integration.test.ts | with defect and report: nothing changes (blank reason) | pass |
| A retired machine cannot be retired again | retire-machine-command.integration.test.ts | machine-retired, original reason kept | pass |
| Helpers cannot retire machines | retire-machine-command.integration.test.ts | not-authorized at the command; page and link also technician-only (code) | pass |

13/13 covered per `check-scenarios.ts`.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e asserts page width <= 360 on question and record | OK |
| List pages with realistic data | no new list | repair history/open lists only add a state | OK |
| Journal entry per command | yes | EVT-MachineRetired, EVT-DefectClosedOnRetirement, EVT-ProblemReportDismissed (system actor), asserted | OK |
| Texts from catalogs | yes | `machineRetire`, `machineRecord.retire*`, `repairHistory.closedOnRetirement`; wording matches story | OK |
| No personal data in logs | yes | reason stays in the aggregate, event data `{}` | OK |
| UX G3/G10/G10b/G11/G18 | yes | confirmation on the record, one question naming consequences (zero parts left out, singular/plural), link only for technicians in section 9, Zurück keeps reason | OK |
| Advisories | n/a | no dependency change | OK |
| Docs (ADR 0010, conventions, context map) | yes | in the diff | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Counts in the question are read at ask time; a report arriving before confirm makes the count stale (still dismissed, retirement is safe) | Concurrency rule only demands nothing stays open – satisfied | question: accept as is |
| Only the zero/one/many wording is tested in e2e for 1 + 2; the "part with zero left out" and no-consequence case has no test of its own | Story Interface: "A part with zero is left out" | fix now (small unit test of `question`) – optional |
| Retire page opened for a machine retired meanwhile / by another tab: form kept with rejection (handled in code, version conflict tested at command) | – | none |
| Defect on hold/claimed are included (state "open"); only resolved ones excluded | Story rule | covered |
| Retired machine in due-maintenance and other lists | Out of scope (ST-055) | existing story ST-055 |
| Helper opening /ausmustern URL directly | G11 | redirected by `requireTechnician`; no browser test, acceptable |
| Long reason text | memory: no max-length question | none |
| English visitor pages show retired machine's report form | Reports are rejected (machine-retired); visitor-facing message not in this story | question: check in ST-055 |

Verdict: accepted with remarks (remarks: the optional zero-parts test of the question text, and the stale-count question; no new story needed).

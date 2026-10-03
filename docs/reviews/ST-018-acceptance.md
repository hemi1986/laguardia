# Acceptance – ST-018: Triage – record a defect, optionally changing the machine status
Date: 2026-10-04 · Tests run: `npm test -- -t "ST-018"` → 9 passed, 0 failed (4 files); `npx playwright test e2e/record-defect.spec.ts` → 6 passed; `check-scenarios.ts ST-018` → 14/14 covered · Preview: none usable (no team account before ST-068) – local evidence only

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician records a defect | record-defect-command.integration.test.ts | Yes. Real command, fixed clock, literals. Defect row (priority normal), triage with outcome and defectId, gone from triageList, journal without the title. | OK |
| Visitors see the title of the new defect | visitor-machine-page.integration.test.ts | Yes through the real page view, de and en. "No longer counts" is checked only as "text 'wartet noch auf die Sichtung' absent" (count 0 case), not with a second still-untriaged report. | OK (weak on the count) |
| Machine status is changed in the same step | record-defect-command.integration.test.ts | Yes. Priority high, status Out of order, history entry with technician and reason = title, both journal entries with the same actor in order. "The form has no reason field" asserted in e2e (`getByLabel("Grund")` count 0). | OK |
| Only Limited or Out of order in the same step | e2e/record-defect.spec.ts | Yes. Exact option list and preselected value, via the real navigation. 360 px width checked. | OK |
| The machine's current status is shown… | e2e/record-defect.spec.ts | Yes. Text "LG-xxx ist zurzeit Eingeschränkt." and options. | OK |
| No stricter status, no status choice | e2e/record-defect.spec.ts | Yes. No select; sentence "ist schon Außer Betrieb – der Status bleibt." | OK |
| Rejected status change rolls back the defect | record-defect-command.integration.test.ts | Command level fully: machine retired, `machine-retired`, problem report untriaged, journal unchanged, history unchanged. NOT checked: "the technician stays at the form and is told that LG-042 is retired by now and nothing was saved". Only `commandErrorText(…, "machine-retired")` contains "ausgemustert" – that is the generic catalog text, not the form's `retiredMeanwhile` text ("… ist inzwischen ausgemustert. Es wurde nichts gespeichert."), which no test renders. | Partly checked – remark R1 |
| Title is required | record-defect-command.integration.test.ts | Yes. `title-required`, untriaged, still in triage list. The message at the form is covered by "A rejected defect keeps what was typed". | OK |
| Two technicians triage the same problem report | record-defect-concurrency.integration.test.ts | Strong on the race: two real transactions held behind a row lock, exactly one wins, loser gets `already-triaged`, only the winner's journal entry. NOT tested: "the message that the problem report was already triaged by Tom". The name path (`recordDefectAction` → `loadProblemReport` → `triagedBy` → `alreadyTriagedBy(name)`, with link „Zurück zur Sichtung“) has no test at all, neither integration nor e2e. The test asserts the error code and the winner id, not the text. | Partly checked – remark R2 |
| Recording a defect is offered on the problem report's page | problem-report.integration.test.ts | Yes. Section "Sichten" and the link to /defekt-erfassen for a technician. (Order of outcomes and the button list are not in scope: other outcomes do not exist yet.) | OK |
| Helpers cannot record defects | problem-report.integration.test.ts | Yes. Helper view lacks the link; helper command gets `not-authorized` (helper actor really has role helper). The form page itself (`requireTechnician`) is not tested for a helper – harmless, the command refuses anyway. | OK |
| A rejected defect keeps what was typed | e2e/record-defect.spec.ts | Yes, with and without JavaScript: alert text, aria-invalid on title, priority high, checkbox, status kept. "Nothing recorded, stays untriaged" is shown by the command test (title required). | OK |
| After recording, the technician is back on the triage list | e2e/record-defect.spec.ts | Yes. URL, exact confirmation text with status sentence, problem report gone from the list, 360 px. | OK |
| Recording a defect is not offered on a triaged problem report | problem-report.integration.test.ts | Yes. Triaged via stand-in; text "schon gesichtet" and no link. | OK |

Foundation items
| Item | Evidence | OK? |
|---|---|---|
| `context.run` same transaction, same person, authorization, rollback | run.integration.test.ts (68 added lines) + record-defect tests (journal actor, rollback) | OK |
| Inner error type in outer result type | run-types.test.ts (35 lines, type test) | OK |
| `runAsSystem` unchanged, policy tests green | Full verify was green at the pushed commit (per task); not re-run by me | OK |
| Records a defect with status change through `context.run` and `collection/index.ts` | record-defect-command.ts imports `changeMachineStatusCommand` from `@/modules/collection` | OK |
| Conventions updated (user approves) | SKILL.md already carries the text (`context.run`, facts on an existing aggregate, domain rejection after a version conflict) – item correctly unticked until approval | pending user |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | Yes | e2e `scrollWidth <= 360` on the form, the rejected form and the triage list | OK |
| Works without JavaScript | Yes (ui) | e2e "without JavaScript": rejection keeps choice, success shows confirmation | OK |
| List pages fast with realistic data | Triage list changed only by one extra lookup (defect title) | No new per-row query | OK |
| Every command writes its journal entry | Yes | EVT-DefectRecorded and EVT-MachineStatusChanged, same actor, asserted in the command test; rolled back with the rest | OK |
| Journal without free text / no personal data | Yes | Journal data = defectId, priority, flag; title not in the journal (asserted with `toEqual`). The status-change entry's journal data is not asserted for the reason (existing command's mapping omits it – verified in code). | OK |
| Texts from the message catalogs | Yes | team.de.ts, visitor.de/en.ts. No literals in the form or page | OK |
| Roles | Yes | Command refuses helpers; the page uses `requireTechnician` | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| R1/R2 above: the two UI rejection texts (naming Tom; retired machine at the form) are untested | Yes – scenarios 7 and 9 "Then" lines | Fix now: one test each, e.g. render `RecordDefectForm` with state / call the action path with a stored triage by "Tom" and assert „Tom hat diese Meldung schon gesichtet.“ plus the link; retired: assert the form keeps the page and shows „… ist inzwischen ausgemustert. Es wurde nichts gespeichert.“ |
| A technician records a defect without a status change on a retired machine (no inner command, so no `machine-retired`) – the defect is recorded and the problem report triaged | Not in the story; context pack: retired machine, "nothing more can be changed or reported" (catalog text) | Question to the user: should a defect on a retired machine be refused even without a status change? |
| Machine's status changed by someone else after the form was opened (machine version stale) | Partly: Q11, `version-conflict` text exists "Bitte lade die Seite neu" | Question: confirm that the generic conflict message at the form is enough (no test exercises it for this form) |
| Stale form where the problem report was triaged meanwhile and the machine status choice is stale: the "already triaged" rejection wins – fine – but the name is looked up in a second call after the failed action (small window; if the name cannot be found the text falls back to the generic "Diese Meldung ist schon gesichtet.") | Decided in the test plan (domain rejection wins) | No action |
| Very long defect title (no maximum in the story, DB `text`, no check); shown on the visitor page, also copied into the status history reason | No rule | Question: max length (the problem report description has 2000)? Visitor list already wraps long text |
| Confirmation on the triage list is driven by `?defectRecorded=<id>` – reload or sharing the URL repeats it; the "now Außer Betrieb" status is read at display time, not at the moment of recording | Story: the address cannot make the page say anything unstored (code comment) – satisfied | Question only (low) |
| Visitor page shows open defects of all priorities and also "suitable for helpers" ones; defects of a machine Not on display / retired are not specially handled | No rule | Question, not needed now |
| Two untriaged problem reports for the same machine, one triaged to a defect: count test only covers the single-report case | Scenario 2 "no longer counts that problem report" | Optional: add a second report to the visitor test |
| English technician UI | Team UI is German only per CLAUDE.md | No action |

## Follow-up hurdle
No finding meets all three conditions (none is a security or data-loss risk that blocks a named story). R1 and R2 are fixable within this story in well under an hour.

## Verdict
**accepted with remarks** – all 14 scenarios have a titled test, tests pass, the definition of done holds. Before the pull request: close R2 (the "already triaged by Tom" message is the explicit point of scenario 9 and is not tested at all) and R1 (the form's "retired, nothing saved" text is not rendered by any test). Foundation item 5 stays open until the user approves the conventions text.

## Resolution (main session, 2026-10-04)
- R1, R2 – fixed: `record-defect-rejection.integration.test.ts` checks the named message after a real triage and the retired-meanwhile text.
- Smaller remarks skipped: the visitor count with a second report (ST-013's count tests cover it); the helper on the form page route (`requireTechnician` plus the command).
- Questions for the user (in the pull request): a defect on a retired machine without a status change; the generic version-conflict text at this form; a maximum title length.

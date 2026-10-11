# Acceptance – ST-023: Technician reports a problem and records a defect in the same step
Date: 2026-10-11 · Tests run: `npx vitest run` → 447 passed / 0 failed (76 files); `npx playwright test e2e/report-and-record-defect.spec.ts` → 10 passed / 0 failed · Preview: https://laguardia-kqn7bh1xi-hemi6.vercel.app (not exercised: deployment protection, no team account in the preview database; judged from tests and code only)

`check-scenarios.ts ST-023`: 18/18 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician reports and records a defect in one step | command integration | Yes: report by Tom, triage outcome, open defect, Limited (record + history), not in triage list, three journal events by Tom. | pass |
| A technician's problem report without a triage part is rejected | command integration | Yes: `triage-required`, nothing stored, journal unchanged, catalog text asserted. | pass |
| A report form loaded before sends nothing for a technician | runner integration | Rejection and nothing stored: yes. Choice page (asking text, "Defekt erfassen" link, no description kept, no form): checked by rendering `TriageChoice` directly. The redirect in `melden/actions.ts` linking the two is untested. | pass – known gap 2a |
| Invalid triage part stores nothing | runner integration | Yes: with a photo and empty title, `title-required`, no report, no defect, no journal entry, storage empty. | pass |
| Two faults become two own problem reports | command integration | Yes: two reports by Tom, own defect each, distinct IDs, both defects open. | pass |
| Technicians are offered recording a defect when reporting | e2e | Yes: link offered, nothing preselected, no input/select/button/form (so nothing can be sent), width <= 360. | pass |
| Helpers report as before | e2e | Yes: no "Sichten", no defect link or title field; a description-only send succeeds with the old confirmation. | pass |
| Helpers cannot record a defect when reporting | runner integration + untitled e2e (redirect) | "Plain form instead": the untitled e2e test checks it. "Send anyway, nothing stored": the runner is built with a helper and expects `not-authorized`. The real action calls `requireTechnician()` first, which redirects a helper to `/team`, so the tested path is not the one a real send takes. Nothing is stored either way. | pass – remark R1 |
| Only a stricter machine status when reporting | e2e | Yes: "currently Limited" sentence, options exactly [no change, Out of order], preselected "no change". | pass |
| No status choice for a machine not on display | e2e | Yes: no status select, sentence "schon Nicht ausgestellt – der Status bleibt." | pass |
| Report without a description stores nothing | e2e | Yes: alert text, description `aria-invalid`, title not marked and still filled, nothing in defect list or triage list. "Problem report not stored" is not observable in the browser (see R2). | pass |
| A missing description is named before a missing title | command integration | Command order is checked, and nothing is stored. The form-level part ("shown with the description marked") is not tested for the case with both missing: the browser test has a title. | pass – remark R3 |
| A rejected report keeps what was typed | e2e | Yes: alert, title marked, description, priority, mark and status kept, defaults checked beforehand, nothing stored. | pass |
| A rejected report says the photo must be chosen again | runner integration | Yes: exact text with the photo, no sentence without one, no photo stored. | pass |
| A rejected photo gets no extra sentence about choosing it again | runner integration | Yes: `not-an-image`, text equals the ST-016 catalog text, does not contain "erneut ausgewählt", title kept, nothing stored. | pass |
| Machine retired in the meantime stores nothing | runner integration | Nothing stored, text and typed values: yes. "The technician stays at the form" is untested (`retired && !state` in the form). | pass – known gap 2a |
| Machine status changed in the meantime stores nothing | e2e | Yes: other tab sets Out of order, rejection text, same page heading, description and title kept, no defect. That no problem report was stored is not visible in the browser (R2). | pass |
| After reporting, the technician is back on the machine record | e2e | Yes: URL and heading of the record, exact confirmation with defect, machine and new status, no "wartet auf die Sichtung", defect open, not in triage list. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Scenario tests titled exactly, verify green | yes | 18/18 traced; 447 unit/integration and 10 e2e tests green | yes |
| Commands via `aggregateCommand`, journal without free text | yes | `reportProblemAndTriageCommand`: journal `data` holds IDs, priority, mark only; title and description stay out | yes |
| No `new Date()` / `randomUUID()` in domain code | yes | The decision gets the clock and IDs from the context; tests use a fixed clock | yes |
| Server Actions only through the runner, actor from `currentPerson()` | yes | `photoFormAction` in both actions | yes |
| Texts from the catalogs | yes | `team.de.ts`, `visitor.de/en.ts` (new `triage-required` text for visitors) | yes |
| Only `index.ts` imported across modules | yes | `modules/repair/index.ts` exports; verify passed | yes |
| Migration for schema change | yes | `drizzle/0014_defect_problem_report_fk_deferred.sql` with snapshot and journal | yes |
| Usable at 360 px | yes | width asserted in 5 of the browser tests; the project is 360 px wide | yes |
| Every command writes its journal entry | yes | three events, asserted | yes |
| No personal data in logs | yes | no logging added | yes |
| Existing tests not weakened (1a) | yes | The removed lines only change how an untriaged report is arranged (visitor or helper instead of technician). `reportAsVisitor` waits for the stored report; the old confirmation assertion is replaced by a URL wait. `current-person` now takes the actor from a machine-model command, and both roles are still asserted. No expect line deleted without a replacement. | yes |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Technician sends the visitors' form on `/m/…/melden` while logged in | Covered by code: command returns `triage-required`; visitor catalogs (de/en) carry a text. No test found for that text. | Fine; optionally a one-line test (remark R4) |
| Description too long together with a defect | `description-too-long` is checked in `reportProblem` before the triage; text exists in the team catalog. Not tested in this form. | Question: add a runner test? Low risk |
| Confirmation when the address names a defect of another machine | Handled: `machine/[museumNumber]/page.tsx` shows it only when the defect's machine equals the record's. Not tested for this story's flow (ST-018 logic). | No action |
| Double submit | Form has a pending state. No idempotency (same as the other forms in the project): two reports and two defects would be possible with two rapid sends without JavaScript. | Question, project-wide, not this story |
| Machine retired when the choice page or the form is opened | Choice page shows the retired text; the form page shows it when loaded retired. Not tested in the browser (no way to retire until ST-039). | Question, tied to ST-039 |
| Technician opens `/melden/defekt-erfassen` for an unknown museum number | Page shows "unknown", with the back link. Untested. | No action |
| Helper with a stale form posting to the technician action | `requireTechnician()` redirects to `/team`: no message, nothing stored. | Question: acceptable? See R1 |
| Not on display and the reported status sent anyway (forged `machineStatus`) | `CMD-RecordDefect` rules apply (same function); not tested in this combination. | Question |
| English: team pages are German only | No rule contradicted. | No action |

## Remarks
- **Known and accepted (test plan 2026-10-11):** (2a) the redirect `triage-required` → choice page in `melden/actions.ts` is untested; "the form stays after retirement" is untested; (3a) helper gets `not-authorized`.
- **R1** (minor): "Helpers cannot record a defect" sends the form through a runner with a helper actor and gets `not-authorized` from the command. The real action first runs `requireTechnician()`, so a helper is redirected to `/team` and sees no rejection. Nothing is stored in both paths, the scenario's outcome holds. A small test of the action guard is optional.
- **R2** (minor): in the browser tests a technician's problem report with no defect cannot be seen anywhere (it is not in the triage list by design), so "problem report not stored" is only backed by the defect list. The atomic rollback of the report when the status change is refused is not tested at the command seam either. The transaction rule in the conventions covers it, but a command test "status no longer stricter → no problem report, no defect" would close the line.
- **R3** (minor): "A missing description is named before a missing title": the form's marking of the description when both are missing is not covered. The command order is.
- **R4** (minor): the visitor-catalog text for `triage-required` has no test.
- The untitled e2e tests (helper redirect, no JavaScript) are good extras. The choice page tests do not count towards any scenario beyond the one named.

No finding reaches the follow-up hurdle (no security or data-loss risk).

## Verdict
**accepted with remarks** – all 18 scenarios have a titled test that runs green. Findings: 0 blockers, 0 majors, 4 minors (R1–R4), plus the accepted known gaps (2a, 3a). The preview was not checked.

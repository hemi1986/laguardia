# Acceptance – ST-020: Triage – dismiss a problem report, removing spam content
Date: 2026-10-09 · Tests run: `npx vitest run --project integration -t "ST-020"` → 11 passed; `npx playwright test e2e/dismiss-problem-report.spec.ts` → 5 passed · Preview: none (checked locally; photo browser tests skip without the Development Blob store)

Traceability: `check-scenarios.ts ST-020` → 14/14 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician dismisses a problem report | dismiss-problem-report-command.integration.test.ts | Yes: real command, fixed clock; asserts outcome, reason, technician, time, journal entry, and absence from `triageList`. | pass |
| Dismissing as spam removes text and photo | verwerfen/dismiss-problem-report.integration.test.ts | Yes: photo written to in-memory storage, form runner, asserts no description/photo, stored photo gone, triage with reason/technician/time, and the page shows the spam notice with no text and no `<img`. | pass |
| Dismissing as spam asks first | e2e/dismiss-problem-report.spec.ts (+ no-JS variant) | Yes for question text, Zurück (nothing dismissed, spam still chosen, still listed), confirm dismisses. The e2e problem report has no photo (Blob unset), so "photo deleted for good" is only in the wording. | pass |
| Failed photo deletion does not undo the dismissal | verwerfen/dismiss-problem-report.integration.test.ts | Yes: failing `delete`; dismissal stands, no description/photo reference; log line holds the stored name and error, not the text or bytes. | pass |
| A reason is required | command integration test | Yes: error `dismissal-reason-required`, stays untriaged and listed. | pass |
| Reason "other" needs a free text | command integration test | Yes (blank text rejected, stays untriaged). | pass |
| Dismissing with the reason "other" | command integration test | Yes, literal text; journal carries only the reason. | pass |
| "Machine retired" cannot be chosen by hand | command test + e2e | Yes: command rejects it; the form shows exactly three radios in order, none checked, no "Gerät ausgemustert". | pass |
| Already triaged problem report | verwerfen/dismiss-problem-report-rejection.integration.test.ts | Yes: Tom triages for real, Eva's dismissal is rejected, Tom's triage is untouched, message "Tom hat diese Meldung schon gesichtet." | pass |
| A rejected dismissal keeps what was chosen | e2e | Yes: alert text, textarea `aria-invalid`, "Anderer Grund" still checked, same URL, still listed. | pass |
| After dismissing, the technician is back on the triage list | e2e | Yes: URL, heading "Sichtung", confirmation with the museum number, entry gone. | pass |
| Dismissing is not offered on a triaged problem report | problem-report.integration.test.ts | Yes. | pass |
| Dismissing is offered on the problem report's page | problem-report.integration.test.ts | Yes: section, link and order checked. The "from the triage list" step is not part of this test; the e2e `openDismiss` walks it. | pass |
| Helpers cannot dismiss | problem-report.integration.test.ts | Yes: link absent for the helper, command returns `not-authorized`. The `/verwerfen` page for a helper (`requireTechnician` redirect) is untested. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts `scrollWidth <= 360` on form, question, rejection and list. | OK |
| List pages fast with realistic data | partly | The triage list query only gets a nullable description; no new query shape. | OK |
| Command writes its journal entry | yes | Asserted (`EVT-ProblemReportDismissed`, actor, machine, `{reason}`). | OK |
| Texts from the message catalogs | yes | `team.de.ts` `dismiss` block and the two rejections. | OK |
| No personal data in logs | yes | The deletion failure logs the stored name and the error message only (test). The free text stays out of the journal. | OK |
| Works without JavaScript | design decision | No-JS e2e passes. | OK |
| DB invariants | yes | Migration 0013 has CHECKs: reason iff dismissed, text iff "other", spam means no description and no photo. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Free text for "other" has no length limit (descriptions are capped at 2000) | No rule | Question; a one-line cap would be cheap if wanted |
| Free text typed with reason spam or "not a fault" is silently ignored | No rule | Question; harmless |
| Spam dismissal of a problem report with a photo: only the integration tests (in-memory storage) cover it, the browser photo test skips locally | Story: photo deleted via the storage seam | Run the photo browser tests where the Blob store exists (preview/CI) |
| Failed deletion leaves an orphaned blob; "retry" is manual from the log line | Story: "can be retried" – approved design says by hand | Accepted; no follow-up story (does not pass the hurdle) |
| A helper opening `/verwerfen` directly: redirect untested | Context: technicians only | Minor remark; the command refuses helpers anyway |
| Spam question when the problem report was triaged meanwhile: the confirm step posts and is rejected with the "already triaged" message | Story scenario "Already triaged" | Covered by the command rejection; fine |
| "Mit Defekt verknüpfen" is not in the outcomes list (page layout names it first) | Another story owns it | Question: confirm it belongs to a later story |
| English or visitor view | Not applicable, team-only | none |
| Dismissed-as-spam page for a helper | Context: page shows it as dismissed | Covered by shared `ProblemReportView` (technician role tested) |

Verdict: accepted with remarks (no scenario gap, all tests pass; remarks above are questions or minor, none reaches the follow-up hurdle).

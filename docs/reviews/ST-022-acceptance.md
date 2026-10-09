# Acceptance – ST-022: Triage – link a problem report to an open defect
Date: 2026-10-09 · Tests run: `npx vitest run -t "ST-022|CMD-LinkProblemReportToDefect|Mit Defekt"` → 13 passed, 0 failed; `check-scenarios.ts ST-022` → 11/11 covered; e2e (`e2e/link-to-defect.spec.ts`) not re-run by me (reported passing by the implementer via `verify.ts --e2e`) · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Open defects of the machine are offered for linking | problem-report.integration.test.ts | Given: untriaged report beside open defect. When: technician page render. Then: link offered, in section "Sichten", ordered before "Defekt erfassen". Defect title is not asserted on the page, but the Then only asks for the offer. | pass |
| Technician links a problem report to an open defect | link-problem-report-to-defect-command.integration.test.ts | Via the command layer: outcome linked, triagedBy, count 1 in open defects list, defect details show the report, journal entry. Literals used. | pass |
| Visitor count drops after linking | visitor-machine-page.integration.test.ts | Real visitor page before (1 waiting) and after link (none, "Bekannte Defekte", title). | pass |
| Defect of another machine cannot be linked | command integration test | Rejected `defect-of-another-machine`, report untriaged, other machine's defect count 0. | pass |
| Already triaged problem report | link-to-defect-rejection.integration.test.ts | Tom triages (resolve on the spot), Eva links: rejected, Tom's triage kept, message "Tom hat diese Meldung schon gesichtet." (via withWhoTriagedFirst + text mapper, not through the rendered form). | pass |
| No open defect, nothing to link | problem-report.integration.test.ts | Link absent, "LG-042 hat keine offenen Defekte." present. | pass |
| A defect has to be chosen | e2e/link-to-defect.spec.ts (+ command test for "defect-required") | Real form: nothing preselected, alert "Bitte einen Defekt auswählen.", stays on form, still untriaged on list, 360 px. Local only (skipped against a preview). | pass (e2e not re-run by me) |
| After linking, the technician is back on the triage list | e2e/link-to-defect.spec.ts | Heading "Sichtung", confirmation text literal, report no longer listed, defects list shows "1 verknüpfte Meldung". | pass (e2e not re-run by me) |
| A defect resolved in the meantime cannot be linked | command integration test | Defect resolved after offer; rejected `defect-not-open`; report untriaged; defect stays resolved. | pass |
| Linking is not offered on a triaged problem report | problem-report.integration.test.ts | Link absent, "schon gesichtet" shown, no "keine offenen Defekte". | pass |
| Helpers cannot link | problem-report.integration.test.ts | Helper page has no link; command rejects with `not-authorized`. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts scrollWidth <= 360 on form and rejection; labels use overflow-wrap:anywhere | OK |
| List pages fast with realistic data | yes (open defects list, triage list) | Link count is a computed value in the existing list query; no performance test was added. | OK (remark: not measured) |
| Command writes its journal entry | yes | Journal entry asserted (type, machineId, actor, defectId) | OK |
| Texts from message catalogs | yes | team.de.ts `link.*`, `linkedProblemReports`, rejection texts | OK |
| No personal data in logs | yes | Journal holds IDs only; Tom's name only in UI | OK |
| Versioned/concurrent triage (HS-16) | yes | aggregateCommand with version; defect row locked `FOR SHARE` | OK |
| Works without JS | nice to have | native radio buttons | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| "Already triaged" is only tested at the message level, not through the rendered form (rejection stays at form, "Zurück zur Sichtung" link) | Story: "rejected with the message that Tom already triaged it" | Remark; the e2e covers the other rejection through the real form. Acceptable. |
| Concurrent linking of two reports to the same defect, or link vs. resolve | Row locked FOR SHARE (code comment) – not tested | Question: add a concurrency test? Not required by a scenario. |
| Defect of another machine is not selectable in the UI, so the rejection exists only at command level | Story scenario is command level | OK |
| `/team/triage?linked=<id>` with a forged ID | Confirmation is read from stored data, so it can only show true facts of a linked report | OK / question: any technician can see it; harmless |
| Machine "Not on display" or retired with open defects | No rule in the story | Question |
| Long defect titles in the radio list | wrap handled by CSS | OK |
| Many open defects on one machine (long radio list) | no rule | Question |
| English/other language | team UI is German only | n/a |
| Helper opening `/verknuepfen` URL directly | `requireTechnician` redirects; command refuses | OK |
| Defect links to a resolved defect | Out of scope (ST-053) | n/a |

## Verdict
**accepted with remarks** – all 11 scenarios have a titled test that checks the Given/When/Then; vitest tests pass. Remarks: the two form-level scenarios ("A defect has to be chosen", "After linking…") rest on local-only e2e specs that I did not re-run; "Already triaged" is verified at the message level, not through the rendered form; no concurrency test for the FOR SHARE lock. None justifies a new story.

## Resolution (implementation, 2026-10-09)

- Remark 3 (no concurrency test for the lock) is fixed: `link-problem-report-to-defect-concurrency.integration.test.ts`. The lock is now `FOR UPDATE` (code review #1).
- Remarks 1, 2 and 4 stay as they are. They match how ST-019/ST-020 split form tests between e2e and integration, and the open defects list is small.
- Open questions: a machine that is *not on display* keeps its open defects, and linking to them is allowed. A retired machine's defects are closed by ST-039, so they are no longer offered. A long list of open defects for one machine is no case today. None of this needs a story change.

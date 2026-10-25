# Acceptance – ST-053: Linking a problem report to a recently resolved defect reopens it
Date: 2026-10-25 · Tests run: `npx vitest run -t "ST-053"` → 8 passed, 0 failed; `npx playwright test e2e/link-to-defect.spec.ts` → 3 passed · Preview: none (local only)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Recently resolved defects are offered for linking | problem-report.integration.test.ts | Resolved 3 days ago via fixed clock; page data and rendered form: open first, "behoben vor 3 Tagen", none checked. | OK |
| Defects resolved longer ago are not offered | same | 31 days ago; not in data, not in HTML. | OK |
| Linking is offered when only a recently resolved defect exists | same | Real page render contains the link, no "keine offenen Defekte". | OK |
| Linking ... reopens it | link-reopens-defect.integration.test.ts | Goes through the form-input mapper and the command; asserts triaged/linked, open, no hold/claim, reason = report, confirmation text with „Der Defekt ist wieder offen.“. | OK |
| Link and machine status change in the same step | link-problem-report-to-defect-command.integration.test.ts | Open, status Out of order, history entry reason "Left flipper weak", journal order link, reopen, status. | OK |
| Only a stricter machine status when linking reopens | same | Rejected with machine-status-not-stricter; defect resolved, machine still Out of order, report still untriaged (proves one transaction / rollback). | OK |
| Reporting and linking in the same step ... | report-and-link.integration.test.ts | Through the form runner; report stored and linked, defect reopened with the report as reason. | OK |
| Link fails, nothing is reopened | link-problem-report-to-defect-command.integration.test.ts | Concurrent triage -> already-triaged; defect resolved, no reopenings. | OK |

Extra (user decisions): status with an OPEN defect rejected (`machine-status-without-reopening`) and 30-day boundary (30 ok, 31 rejected, Berlin days) are tested in the command test. The browser spec covers the flow at 360 px (width asserted), status change, confirmation and „Wegen der Meldung: „…““ on the defect page.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e asserts page width <= 360 on the link page | OK |
| List pages fast | marginal | defect list is per machine, small | OK |
| Journal entry per command | yes | journal order test: link, reopen, status change | OK |
| Texts from catalogs | yes | repair.ts messages (DE) | OK |
| No personal data in logs/journal | yes | reopen reason (problem report text) kept in aggregate, journal event carries only the problemReportId | OK |
| One transaction | yes | nested `run(reopenDefectCommand)`; rollback shown by the "stricter" test | OK |
| Migration | yes | drizzle 0029 reopen reason problem report | OK |
| Advisories | n/a | no dependency change | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| „Wegen der Meldung“ in the repair history (user decision 3) is implemented (`repair-history.tsx`) but no test asserts it; only the defect page is asserted in e2e | Decision 3 says both places | fix now: add an assertion (small) |
| Defect reopened by a link while a Helper... only technicians may link (ST-022) | yes | none |
| Machine Not on display / retired: no status choice is offered by ST-018 rule; not tested on this page | Story context | question: cover with one test if cheap |
| Two technicians link two reports to the same resolved defect: second sees stale version -> rejected; not tested | HS-16 | question |
| Long description in „Wegen der Meldung“ on 360 px | none | question |
| Hint text for the status choice: wording check only visually | decision 1 | none |
| Defect resolved exactly 30 days ago, around midnight Berlin | covered by the boundary test | none |

Verdict: accepted with remarks (all 8 scenarios have real tests and pass; remark: add a test for the repair-history display of „Wegen der Meldung“).

## Refactor (2026-10-25)
- Remark fixed: the repair history's „Wegen der Meldung: …“ is asserted in `repair-history.integration.test.ts`.
- Open questions, not taken up (no hurdle): status choice on a Not on display machine (MachineStatusChoice already says the status stays – ST-018's tested behaviour); two technicians linking at once (the defect row is locked `FOR UPDATE`, the second fails the problem report's or the defect's version check); long descriptions at 360 px (`whitespace-pre-line` in a `Page` that wraps words).

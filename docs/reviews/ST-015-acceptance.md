# Acceptance – ST-015: Team member reports a problem from the machine record
Date: 2026-10-03 · Tests run: `npm test -- -t "ST-015"` → 4 passed, 0 failed; `npx playwright test e2e/team-report-problem.spec.ts` → 1 passed · Preview: none usable (no team account before ST-068; local tests are the evidence). `check-scenarios.ts ST-015`: 4/4 covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Helper reports a problem | `melden/report-problem.integration.test.ts` (form runner as Anna) + e2e `team-report-problem.spec.ts` | Given: machine from builder (default status, Playable assumed – the status is not named in the test). When: the report form's fields/input run through the Server Action runner as Anna, with the literal description. Then: stored report has machineId, literal description, reporter = Anna; waits for triage via untriaged count 1. E2E walks the real page from the record and checks the confirmation text and 360 px width. The Server Action itself is not run (the runner is), the e2e does not read back the reporter. | pass |
| Team members can report for machines not on display | `report-problem-command.integration.test.ts` | Given: machine registered "not-on-display". When: command as helper. Then: ok and the report is stored with the literal description. The e2e also uses a not-on-display machine through the UI. | pass |
| Description is required | `report-problem-command.integration.test.ts` (+ e2e shows the message and aria-invalid) | When: empty description as helper. Then: error `description-required`, nothing stored. Whitespace-only is covered by the existing visitor/decision tests (shared decision, trimmed). | pass |
| No problem reports for retired machines | `report-problem-command.integration.test.ts` | Given: machine really retired through the retire command by a technician. When: helper and technician report. Then: `machine-retired` for both, nothing stored. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts scrollWidth <= 360 on the record after reporting (phone viewport project) | OK (the form page itself is not measured, but it is one textarea and a button) |
| List pages fast | no | no list page | n/a |
| Command writes its journal entry | yes | shared `reportProblem` decision emits EVT-ProblemReported; the existing journal tests of the command cover the entry, the actor test (line ~85) covers team members | OK |
| Texts from the message catalogs | yes | `team.de.ts` (reportProblem, machineRecord, errors); visitor catalogs gained `machine-retired` in both languages | OK |
| No personal data in logs | yes | description is not journaled (existing test "journals ... without its description"); no new logging | OK |
| Access control | yes | page and action call `requireTeamMember`; the command checks the machine again from the posted ID | OK |
| Retired machine | yes | link hidden on the record; the page shows a refusal text; the command refuses | OK (hidden link and the refusal page are not covered by a test) |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Retired machine: link hidden and /melden shows a refusal instead of the form – untested in UI | Story Context: "not shown for a retired machine (G11)" | Remark, optional: add an e2e/render test (under the hurdle; no new story) |
| Visitor now also gets `machine-retired` (a visitor report for a retired machine is refused) | Context pack CMD-ReportProblem rules: "not for retired machines" – consistent, with the new visitor texts | OK, no action |
| Double submit / description of 2000+ chars: error `description-too-long` text exists and the field is marked invalid | Aggregate invariant on length (existing) | OK; not tested on the team form, shared decision is |
| Success URL uses `?gemeldet=1` while the status change uses `?statusChanged` – inconsistent query names | none | Question / tidy-up, low value |
| Machine retired between opening the form and submitting | Command refuses with `machine-retired`, form shows the catalog text | OK |
| Unknown museum number on /melden | machineRecord.unknown text shown | OK |
| Technician's own report triaged in the same step | ST-023 (out of scope) | none |
| Report appears nowhere visible yet (no triage list before ST-018/ST-021?) | Story only requires "waits for triage" | Question: confirmation text is the only user feedback until the triage queue exists |

Remarks are small; none meets the follow-up hurdle.

## Verdict
accepted with remarks (all four scenarios have real, passing tests; the remarks are the untested retired-machine UI and the inconsistent query name).

## Resolution (main session, 2026-10-03)
- Hidden button for a retired machine: now tested at the record page seam (the refusal page for a retired machine stays untested – it is a direct read of `retired`).
- Query names: the team confirmation is now `?problemReported`, like `?statusChanged`.
- The Server Action itself: skipped – the runner seam with the form's own fields and input function is the catalogue's seam; the e2e runs the action.
- User, 2026-10-03: accepted („abgenommen“).

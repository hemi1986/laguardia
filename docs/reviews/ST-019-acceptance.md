# Acceptance – ST-019: Triage – resolve a problem on the spot
Date: 2026-10-05 · Tests run: `npm test -- -t "ST-019"` → 4 files, 5 passed, 0 failed (the 3 browser scenarios are in `e2e/resolve-on-the-spot.spec.ts`, not re-run by me; the caller reports `verify.ts --e2e` green at aae84ea) · Preview: none

Traceability: `check-scenarios.ts ST-019` → 8/8 covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Offered on the problem report's page | `triage/[problemReportId]/problem-report.integration.test.ts` | Renders the page for helper and technician; asserts section „Sichten“, link to `/direkt-behoben`, label, and order after „Defekt erfassen“. Opening from the list is not exercised (page rendered directly) – acceptable | pass |
| Helper resolves on the spot | `modules/repair/resolve-problem-on-the-spot-command.integration.test.ts` | Real command layer, fixed clock, helper Anna. Asserts triage outcome/actor/time/trimmed note (literals), journal has no defect event, note kept out of journal, report absent from `triageList` | pass |
| Visitor machine page no longer counts it | `app/m/[museumNumber]/visitor-machine-page.integration.test.ts` | Before: "1 Meldung wartet…" shown; after resolving: no "Sichtung" in page; also asserts the note is not leaked | pass |
| A note is required | `e2e/resolve-on-the-spot.spec.ts` (+ domain case in command test) | Real form as helper, empty submit: alert text, `aria-invalid` on the field, 360 px width, report still listed | pass (local e2e) |
| Already triaged problem report | `direkt-behoben/resolve-on-the-spot-rejection.integration.test.ts` | Tom records a defect, Anna's command rejected `already-triaged`; text "Tom hat diese Meldung schon gesichtet." asserted as literal | pass |
| Rejected resolution keeps what was typed | `e2e/resolve-on-the-spot.spec.ts` | Second browser context triages meanwhile; asserts alert, same form heading, note still filled, nothing recorded implied by the rejection | pass (local e2e) |
| Back on the triage list | `e2e/resolve-on-the-spot.spec.ts` | Asserts URL, heading „Sichtung“, confirmation with machine number, report no longer listed, 360 px | pass (local e2e) |
| Not offered on a triaged problem report | `problem-report.integration.test.ts` | Triaged report, helper and technician: "schon gesichtet" shown, link absent | pass |

Remarks on the tests:
- Three scenarios are only covered by browser tests that skip against the preview (need a local technician account, ST-068). Accepting on the preview cannot re-run them; this is documented in the spec.
- "Already triaged" is verified at command + message level; the full page path of that rejection is covered by the e2e keep-typed scenario.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts `scrollWidth <= 360` on the error state and on the triage list after success | OK |
| List pages fast with realistic data | little | triage list change is one extra lookup only when `?resolvedOnTheSpot=` is present | OK |
| Command writes its journal entry | yes | `EVT-ProblemResolvedOnTheSpot` journal entry asserted (actor, machineId, aggregate) | OK |
| Texts from message catalog | yes | all strings in `src/platform/messages/team.de.ts` (`resolveOnTheSpot`), wording matches story | OK |
| No personal data in logs/journal | yes | the typed note is kept out of the journal (`data: {}`), asserted | OK |
| Works without JavaScript | yes (progressive form) | e2e "without JavaScript" case | OK |
| Authorization | yes | helpers and technicians allowed, visitor refused (tested) | OK |
| Migration | yes | `0012_problem_report_triage_note.sql` adds the note column | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Whitespace-only note | Rule "a note is required"; handled (trimmed, `note-required`, tested at command level) | none |
| Very long note | No limit stated in story | question: is there a maximum length? (UI wraps, DB column unbounded?) |
| Opening `/direkt-behoben` URL of an already triaged report directly | Page deliberately renders the form (needed to keep the rejection); submit is rejected with "<Name> hat diese Meldung schon gesichtet." | fine; remark only |
| Confirmation URL `?resolvedOnTheSpot=<id>` | Shown only if stored as resolved on the spot; invalid/foreign id shows nothing | fine |
| Machine status "Not on display"/retired | No rule; resolving a report of a retired machine is allowed | question (low) |
| Confirmation shown again on page reload / bookmarked URL | Not a rule | remark only |
| Other language | Team UI German only | n/a |
| Concurrent double submit by the same helper | Version check rejects 2nd; message would name the helper herself ("Anna hat diese Meldung schon gesichtet") | remark only |

No finding meets the follow-up hurdle.

## Verdict
accepted with remarks (remarks: three scenarios rely on local-only browser tests; note length limit is a question).

## Resolution (main session, 2026-10-05)
- Note length: recorded in `docs/stories/OPEN_QUESTIONS.md` (recommendation 2000 characters, via ST-020's checklist) – not decided in the code.
- Retired machine: no change – retiring a machine closes its untriaged problem reports (ST-039, POL on EVT-MachineRetired), so none is left to resolve on the spot.
- Double submit naming the helper herself, local-only browser tests: remarks, no change.

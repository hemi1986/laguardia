# Acceptance – ST-050: Dashboards mark what is new since the last visit
Date: 2026-10-24 · Tests run: `npm test -- -t "ST-050|Last visit|decideVisit"` → 15 passed, 0 failed (4 files); `check-scenarios.ts ST-050` → 10/10 covered. The full browser run (174 passed) was reported by the implementer, not repeated. · Preview: none (checked against code and local runs; the phone check is left to the user)

Decisions of the test plan checkpoint (2026-10-24) are taken as given: marked are technician section 1 (count) and section 5, helper sections 1 and 2; not marked are technician sections 2-4 and helper section 3; separate count line; storage in `dashboard_visit`, not journaled (ADR 0011).

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| The triage section says how many waiting problem reports are new | technician-dashboard-new.integration.test.ts | Yes. Last visit 09 Jun 18:00 recorded through `recordVisit`, 3 reports (one for LG-042 at 10:00), opened at noon via the loader and rendered. Asserts `{untriaged: 3, newSinceLastVisit: 1}` and the line "1 davon neu seit deinem letzten Besuch." as literals. | pass |
| The mark disappears after the visit | same | Yes. Noon visit counted 1 (asserted in the helper); 13:30 gives 0 and the text is absent from the HTML. | pass |
| Coming back within the hour keeps the marks | same | Yes. Opening the report records nothing; 12:20 still shows 1 and "Neu seit deinem letzten Besuch." | pass |
| Staying logged in does not hide changes | helper-dashboard-new.integration.test.ts | Yes. Anna's visit 3 days ago, Ben takes over 2 days ago, asserts the `taken-over` change by Ben is new and the rendered "Ben hat übernommen · vor 2 Tagen · <strong". The 30-day session is only a comment (the session plays no part in the code, so that is acceptable). | pass |
| The last visit is shared across phone and workshop PC | technician test | Mostly. "Devices" are two `recordVisit` calls for the same member id (one row per member by design); 11:00 report is not new at 13:30 (`newSinceLastVisit: 0`, untriaged 1). | pass |
| Own actions are not marked | technician test | Yes. Tom's own resolution is shown (title in the HTML) with `newSinceLastVisit: false`; Ben's status change is marked; exactly one marker in the HTML. | pass |
| Nothing is marked on the first visit | helper test | Yes. Two defects shown, all `false`, no marker text. | pass |
| An action on the dashboard does not end the visit | technician test | Yes. Tom's action goes through the real command; the re-render (loader only, no record) and the return 5 minutes later both keep the marks of Ben's changes. The Server Action re-render is simulated by calling the loader; the client-effect claim itself is not tested in a browser (see edge cases). | pass |
| Technician dashboard reaches back to the last visit | technician test | Yes. Last visit 12 days ago, change 10 days ago, shown with the marker in the rendered line. | pass |
| No notifications are sent | src/platform/no-notifications.test.ts | Weaker than the Gherkin: no behaviour is run (no problem report is recorded, no outbox is inspected). It scans the repo for mail/push dependencies and APIs, and has a self-test that proves each pattern fires. The test says so itself. Reasonable, since no sending mechanism exists; a new mechanism under another name (an HTTP call to a mail provider) would not be caught. | pass (remark) |

Additional tests beyond the scenarios: `visit.test.ts` (rule `decideVisit`), helper section 2 marking (user decision 2026-10-24), e2e in `e2e/helper-dashboard.spec.ts` (first visit marks nothing, later recorded defect is marked, 360 px width).

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts `pageWidth <= 360` for the helper dashboard. The technician dashboard has no 360 px check for the new count line or the bold marker (short text, wraps normally). | OK (remark: technician not browser-checked) |
| List pages fast with realistic data | yes, slightly | One extra single-row read by primary key per dashboard load; marks computed in memory. No new list query. | OK |
| Every command writes its journal entry | no (decided) | `recordVisit` is not a domain command; ADR 0011 says not journaled. The ADR is still `proposed`; the user accepts it. | OK, depends on ADR acceptance |
| Texts from message catalogs | yes | `dashboardTexts.newOfWaiting`, `newSinceLastVisit` in `src/platform/messages/team/dashboard.ts`. The tests use literals. | OK |
| No personal data in logs | yes | No logging added; the Server Action takes no input and takes the identity from the session only. | OK |
| Advisories | n/a | no dependency added | OK |
| Migration | yes | `0028_dashboard_visit.sql`, FK to `team_member` with cascade. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation: fix now / new story / question |
|---|---|---|
| Second tab or reload within the hour | Yes, Context ("reload belongs to the current visit"); `decideVisit` unit-tested, and `recordVisit` writes only when a visit begins and only over the row it read | covered |
| Two devices opening at the same moment after an hour | Yes, one visit; the conditional update on `currentVisitStartedAt` and `onConflictDoNothing` protect against double writes. No concurrency test. | question: a test of two simultaneous `recordVisit` calls would be cheap |
| Dashboard left open on a tab for hours, then the user acts | Marks are computed at render; the effect ran once at first show. A re-render after an action shows computed marks from `decideVisit`, consistent. | none |
| Record fails (offline phone, action error) | Not specified. The effect is `void recordVisitAction()` with no retry or error handling: the Last visit is not advanced, so the marks stay longer (safe direction). | question |
| Helper section 3 / technician sections 2-4 not marked | Decided by the user (2026-10-24); the story Context says "everything" is marked | Story text still says "everything that is new"; note only, since the user decided |
| Technician section 5 reaches back beyond 7 days: heading text "Keine Änderungen in den letzten 7 Tagen." (empty state) and a possible heading "last 7 days" would be wrong when the list reaches back further | Story Context: "if that is longer ago than 7 days" | question: check the section heading and the empty-state wording on the phone |
| A very old Last visit (months away) loads an unbounded change list | No limit in the story | question; the dataset is small for one museum |
| A reporter who is a team member reports a problem: excluded from the count as own action | Yes, Context "own actions never marked" (implemented via `reporter.teamMemberId`; no dedicated test for the count) | covered in code, untested for the count |
| Helper claim/takeover by the helper themselves | Own changes are left out by `changesOnClaimedDefects` (ST-086) | covered |
| A defect that is not suitable for helpers any more / retired machines | No rule in the story | question |
| Language | All dashboard texts are German (team area); no English variant needed | none |

## Verdict
accepted with remarks

Remarks (none blocks, none passes the follow-up hurdle):
1. "No notifications are sent" is a static scan, not the Gherkin behaviour; acceptable because no sending path exists.
2. ADR 0011 is still `proposed`; the user must accept it with this PR.
3. The mechanism "an action re-render does not record a visit" is tested only by calling the loader; the browser test only covers first visit + marked defect. A technician browser check on the phone (new count line, bold marker, section 5 heading/empty text) is left to the acceptance on the preview.
4. No concurrency test for two devices opening in the same instant.

## Resolution (implementer, 2026-10-24)

- 1 – no change: no way to send a notification exists to be called; the scan catches one being added.
- 2 – not so: ADR 0011 is `accepted` (ST-087, 2026-10-24).
- 3 – the render-without-visit case got its own test (code review #1); the marks on the technician dashboard are checked by the integration tests' rendered HTML; the user checks the phone at acceptance.
- 4 – fixed: „Keine Änderungen seit deinem letzten Besuch.“
- 5 – fixed: test "two devices opening the dashboard for the first time at the same moment begin one visit" (fails without `ON CONFLICT DO NOTHING`).
- 6 – the rejection is caught now; a failed recording keeps the previous Last visit.
- 7 – the user's decision 1a; named in the pull request.

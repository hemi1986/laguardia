# Acceptance – ST-034: Move a machine to a new location
Date: 2026-10-18 · Tests run: `npx vitest run move-machine-command.integration.test.ts machine-record.integration.test.ts` → 15 passed, 0 failed; `npx playwright test e2e/move-machine.spec.ts` (local) → 3 passed · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Helper moves a machine | `e2e/move-machine.spec.ts` "ST-034: Helper moves a machine"; the command side in `move-machine-command.integration.test.ts` (case "a helper moves a machine …", not ST-titled) | Given: LG-xxx registered at "Hall 2, row 3" (generated number, not literally LG-042). When: a helper logs in, goes record -> link -> page -> form. Then: the record shows the location, the overview card shows it, the confirmation text is asserted literally ("<no> steht jetzt in „<loc>“."). Integration test asserts "Workshop" (trimmed) in record and overview, journal event, actor, no location in the journal. | pass |
| Location is required | `move-machine-command.integration.test.ts` "ST-034: Location is required"; UI in e2e "a rejected move stays …" | Empty and blank rejected with `location-required`, location kept at "Hall 2, row 3", no new journal entry. | pass |
| Retired machines cannot be moved | `move-machine-command.integration.test.ts` "ST-034: Retired machines cannot be moved"; link hidden in `machine-record.integration.test.ts` | Machine retired via real command, move rejected `machine-retired`, location unchanged; the record offers no "Standort ändern" for it. | pass |
| (decision 2026-10-18, in Context) same location rejected | integration "the location the machine already has is rejected …" + e2e rejection test | `location-unchanged`, trimmed comparison, nothing journaled; UI names machine and location, keeps typed text. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e asserts `pageWidth <= 360` on the form, the record and the rejected form | OK |
| List pages fast | no new list | – | n/a |
| Journal entry per command | yes | `EVT-MachineMoved` asserted in the journal | OK |
| Texts from message catalog | yes | `team.de.ts` (`machineMove`, `machineRecord.moved/changeLocation`, rejection `location-unchanged`) | OK |
| No personal data in logs / journal | yes | location (typed text) kept out of the journal (`data` = {}) | OK |
| Works without JavaScript | yes (project pattern) | e2e "without JavaScript" | OK |
| Advisories | not story specific | – | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Confirmation is built from `?moved=1` and the record's current location, not from the move itself: reloading or bookmarking the URL repeats it, and after a concurrent second move it names the other person's location | no rule (same pattern as `statusChanged`) | question / minor, leave |
| Two people move the same machine at once | HS-16 version check is wired (`version` in the form); no test of the `version-conflict` message in this story | minor: covered by the shared command layer; question if a dedicated test is wanted |
| Opening `/standort` for a retired or unknown machine by URL | page shows a "retired" / "unknown" text, no form; not tested in e2e or integration | minor: add a small test or leave |
| Location with only inner whitespace changes ("Hall  2") or case change ("workshop" vs "Workshop") | trimmed exact comparison: case change counts as a change | question (fine as is) |
| Very long location text | no max length (project decision: no max-length questions) | none |
| Technician moving a machine | allowed actors helper and technician; only the helper is walked through in e2e, technician in the integration test for the retired case only | minor |
| Visitor (not logged in) | `requireTeamMember` guards page and action | none |
| Happy-path integration test not ST-titled and the e2e uses a generated number, not "LG-042" | traceability satisfied by the e2e title; literals differ only in the machine number | minor |

No blockers, no majors. No gap passes the follow-up hurdle.

Verdict: **accepted with remarks** (minor remarks only: untested direct URL for a retired/unknown machine, no explicit version-conflict test for this form, confirmation derived from the current location).

## Resolution (implementation, 2026-10-18)
- **#1 skipped minor** – the move page's retired text is the status page's pattern; a retired machine cannot be made in the browser before ST-039 (CMD-RetireMachine), and the record's view test covers that no link is offered. Revisit in ST-039.
- **#2 skipped minor** – the version check is the command layer's and is tested there (`problem-report-version.integration.test.ts`); the form posts the version through `VersionField` like every form on an aggregate.
- **#3 skipped minor** – the same pattern as `statusChanged` (ST-012); revisit together with code review #4.
- **#4 no change** – browser tests need unique museum numbers (shared database, preview); the command test arranges "LG-042".
- **#5 no change** – the technician moves a machine in the no-JavaScript browser test and in the command test.

# Acceptance – ST-035: Correct a machine's museum number or serial number
Date: 2026-10-25 · Tests run: `npm test -- -t "ST-035"` → 8 passed (2 files); `npx playwright test e2e/correct-machine-details.spec.ts` (local) → 4 passed. Caller's last full `verify.ts --e2e`: 1039 unit/integration passed, e2e 193 passed, 1 unrelated failure (ST-037 large download timeout, Blob store). · Preview: none

Traceability: `check-scenarios.ts ST-035` → 9/9 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician adds a serial number later | correct-machine-details-command.integration.test.ts | Given: registered LG-042 without serial. When: real command through `executeCommand`. Then: record has "MM-12345" (literal). Yes. | pass |
| Technician corrects a mistyped museum number | e2e/correct-machine-details.spec.ts | Browser on 360 px: form, redirect to new number, confirmation text asserted in German literally, status history ("Erfasst als Spielbereit") came along, QR sticker page shows the code for the new number. Numbers are random free ones (400–599), not literally LG-420/LG-042, because the shared e2e DB; acceptable. "No machine has LG-042" is covered by the free-number retry. | pass |
| The old museum number stays reserved | command integration test | Given correction LG-420→LG-042 via the real command; When register LG-420; Then `museum-number-taken`. Yes. | pass |
| Old QR sticker keeps working | e2e spec | Visitor context at 360 px opens `/m/<old>`, lands on `/m/<new>` with the machine title. Also covers team-record redirect (foundation item). | pass |
| New museum number already used | command integration test | Retired LG-013 exists, correction of LG-042 to LG-013 rejected, LG-042 unchanged. Yes. | pass |
| Correction and registration race for the same number | command integration test | Real `Promise.all` of both commands; exactly one ok, other `museum-number-taken`, owner of LG-060 is the winner. Yes. Register-level lock and unique-violation guarantees additionally in museum-numbers.integration.test.ts. | pass |
| Reserved number cannot be taken by a correction | command integration test | Reservation made by a real correction; second machine rejected. Yes. | pass |
| Retired machines cannot be corrected | command integration test | Retired through the real retire command; rejected with `machine-retired`. Yes. | pass |
| Helpers cannot correct machine details | command integration test | Helper actor, both museum number and serial number, `not-authorized`, state unchanged. Command level only; the page (refusal text) and action (`requireTechnician`) are not browser-tested for a helper. | pass (remark) |

Foundation checklist: register (`museum-numbers.ts`) with integration tests, facts on changing commands (type test `facts-types.test.ts`), redirect for reserved number (e2e + machine-record integration test), stand-in replaced (`machines.test-support.ts` changed). History-store item is justified by a note in the story. Evidence found for all.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts page width <= 360 on record and visitor phone context | OK |
| List pages fast | no | no list page touched | n/a |
| Command writes its journal entry | yes | `EVT-MachineDetailsCorrected` projection in `events.ts` (museum numbers as references, serial number kept out as typed text); `journal: collectionEvents.journal` in the command | OK (no test asserts the journal row for this command specifically; generic journal coverage via the command layer) |
| Texts from message catalogs | yes | `teamMessages.machineCorrection`, German | OK |
| No personal data in logs | yes | journal data holds only museum numbers | OK |
| Advisories | no | no dependency added | n/a |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Two technicians correct the same machine at once | Version check (HS-16) is in the command; no ST-035 test | question: fine as is, covered by platform tests |
| Chain correction A→B→C: both A and B stay reserved and lead to C | Context: "old number becomes reserved, never reused" | question: add a quick test if cheap; not blocking |
| Helper opens `/angaben` directly | Technicians only (HS-18); page shows refusal text, action calls `requireTechnician` | remark: no browser test for the helper path; optional |
| Retired machine opens `/angaben` | Rule: not retired; page shows text | covered by logic, no browser test |
| Correction submitted unchanged | Not in story; code returns `machine-details-unchanged` (as ST-034) | question: confirm the rejection text exists in the catalog |
| Removing a serial number by an empty field | User decision 2026-10-25 | covered by decision, no scenario or test for "empty removes serial" | 
| Serial number uniqueness across machines | Not a rule anywhere | question |
| English visitor page redirect from old sticker | Same redirect on `/m/` | works for the German e2e; English not checked, low risk |
| Next free number after corrections to high numbers (above LG-999 counting down) | Foundation text | covered by register tests; e2e comments note the interplay with ST-010's LG-999 |

No gap meets the follow-up hurdle; none needs a new story.

## Verdict
accepted with remarks

Remarks (all minor, fixable in this story or left as lines here): (1) no test for the empty-serial-number-removes-it decision (a one-line integration test would pin it); (2) helper and retired page paths have no browser test; (3) the "mistyped museum number" e2e uses random numbers instead of the scenario literals (reasonable given the shared database).

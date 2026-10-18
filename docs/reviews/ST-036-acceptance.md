# Acceptance – ST-036: Correct a machine model
Date: 2026-10-18 · Tests run: `npx vitest run -t "ST-036"` → 9 passed (3 files), 0 failed; `npx playwright test e2e/machine-models.spec.ts` (local) → 8 passed, 0 failed · Preview: none yet (no pull request)

Traceability: `check-scenarios.ts ST-036` → 10/10 scenarios covered.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician corrects the year | correct-machine-model-command.integration.test.ts | Yes. Model with year 1979 plus a machine. The command runs through `executeCommand`. Literal 1997 is asserted on the machine record and on the visitor machine read model. | pass |
| Correcting the technology changes the applicable maintenance tasks | due-maintenance.integration.test.ts (ST-036 block) | Yes. Fireball is Pinball/Solid-state, the task is restricted to Pinball/EM, and fuses has two records. The correction runs on 2026-06-01. The test asserts the task is not due on 08-31, has lastDone "2026-06-01" and dueSince "2026-09-01", and that the records are unchanged. | pass |
| A task that no longer applies leaves the due list | same | Yes. LG-020 is listed as due before the correction (precondition asserted) and not listed after it. The record is kept (outcome partially-done). | pass |
| Technology must fit the machine category | correct-machine-model-command... | Yes. Galaxian is Arcade/CRT, technology set to EM, error literal asserted, and the stored technology is still crt. | pass |
| Required details stay required | same | Yes. Empty title, empty manufacturer and missing category are each rejected with their own error, and the title stays unchanged. | pass |
| A given year must be a four-digit calendar year | same | Yes. "19x7" is rejected and the year is still 1979. | pass |
| Creating a machine model happens on its own page | e2e/machine-models.spec.ts | Yes. It goes from the list via the "Neues Modell" link to /new, which has no articles. After submit it lands on the list with the "Modell „…“ angelegt." status. The 360 px width is also checked. | pass |
| A machine model has its own page | e2e/machine-models.spec.ts (+ machineModelForTeam integration test) | Yes. Three machines are registered, the model is opened from the list, and all five details plus the "Modell korrigieren" link are checked. | pass |
| The correction form says how many machines it affects | e2e/machine-models.spec.ts | Yes. The literal "Gilt für alle 3 Geräte dieses Modells." is asserted. One machine and no machine are not in the e2e test. Zero is covered ("Noch kein Gerät…"); the count itself, retired machines included, is in the integration test. | pass |
| Helpers cannot correct machine models | correct-machine-model-command... | Partly. The command rejects the helper (`not-authorized`) and nothing changes. The pages and the action use `requireTechnician`, but there is no browser or page test that a helper is turned away. This matches how the other "helpers cannot" scenarios are tested. | pass (remark) |

Extra tests beyond the scenarios: unchanged correction is rejected, journal data without typed text, category-history migration, "applied before and after keeps last done", rejected input is kept in the form, and a no-JS flow.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | `pageWidth <= 360` is asserted on the new, detail and correction pages and after a correction. | OK |
| List pages fast | n/a | The model list is unchanged apart from a link. | OK |
| Every command writes its journal entry | yes | `EVT-MachineModelCorrected` is journaled with category and technology. The creation entry is migrated from the journal. A rejected or unchanged correction writes nothing (journal length 1). | OK |
| Texts from the message catalogs | yes | `team.de.ts` extended. German strings are asserted in the e2e tests. | OK |
| No personal data in logs / journal | yes | The test "no typed text" confirms the journal holds only category and technology. | OK |
| Advisories | n/a | No dependency change. | OK |
| Concurrency (HS-16 version) | yes | The input carries the version. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Two technicians correct the same model at once (stale version) | Version in the input (HS-16). No scenario or test for the stale-version message. | question: is the generic conflict message enough? |
| Several corrections on the same day, or a correction back to the old technology | Not specified. The history gets one entry per change, and the "newly applies" logic is covered only for one change. | question |
| A retired machine's model gets corrected | Decided: count includes retired machines. The count is tested; the effect on due maintenance for retired machines is not. | minor, no action |
| Unknown or non-UUID model ID in the URL | Handled ("unknown" text; `machineModelForTeam` returns undefined, tested). | OK |
| The same title and manufacturer as another model | No rule. | question (a possible duplicate) |
| English UI | Team pages are German only. | OK |
| Helper opening the correction URL | `requireTechnician` guards it, but it is untested at page level. | minor |

## Findings
- blocker: none
- major: none
- minor: the helper rejection is verified only on the command, not at page or action level (same as the other stories). No follow-up story.

Verdict: **accepted with remarks**

## Resolution (implementation, 2026-10-18)
- **Helper rejection only at the command seam – no change**: the pages and actions call `requireTechnician()` like every machine model page since ST-006; the test plan put the scenario at the command seam (user, 2026-10-18).
- **Open questions – no change, no new rule**: a stale version gets the shared conflict text, which asks to send again with the kept input (G8, G13); several corrections on one day append one entry each, and a correction back to an earlier technology starts a new run – covered by "a task that applies again after a second correction counts from that one"; two machine models with the same title and manufacturer were allowed by ST-006 and stay allowed (out of this story's scope).

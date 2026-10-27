# Acceptance – ST-095: Change the machines of a maintenance task
Date: 2026-10-27 · Tests run: `npx vitest run --project integration -t "ST-095"` → 15 passed, 0 failed; `npx playwright test e2e/maintenance-plan-machines.spec.ts -g "ST-095|helpers are not offered|without JavaScript"` → 6 passed · Preview: none · `check-scenarios.ts ST-095` → 17/17 covered

Files: C = `src/modules/maintenance/change-machines-of-maintenance-task-command.integration.test.ts`, P = `src/app/(team)/team/maintenance-plan/[maintenanceTaskId]/geraete-aendern/change-machines.integration.test.ts`, E = `e2e/maintenance-plan-machines.spec.ts`.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A technician adds a machine | E (titled); C (untitled "adds a machine…") | E: ticks LG-3, sends via the real form, asserts the landing text and "Gilt für 3 Geräte", and a re-send. C: asserts the task applies to 3, due since 2026-06-10 on the new machine, and the journal entry. Split across seams, all Thens covered. | pass |
| Task page shows count and leads to form page | E | Count and link above the first field (DOM order), heading, back link, 360 px. | pass |
| Machines ticked, groups closed | P | 4 of 6 EM machines: header literal "Flipper · EM – 4 von 6 ausgewählt", no `open`, exactly those 4 ticked. | pass |
| Removed machine no longer due, keeps records | C | Two records, removal, no longer due, both records still read, journal entry. | pass |
| Machine added again is due at once | C | Done 1 Mar, removed 1 Apr, re-added 10 Jun: dueSince 2026-06-10, lastDone undefined. | pass |
| Done record backdated still counts | C | Record 5 Jun gives due 5 Jul (and not 4 Jul). | pass |
| Form opened before another change | P | Goes through `formRunner` with `seen`; the result is LG-043 only, no rejection. | pass |
| Two changes at the same time | C | Real `Promise.all` of two commands, both ok, 3 machines, all due. | pass |
| Adding what someone else added | C | No rejection, count 2, due date from Eva's change, no new event. | pass |
| Machine retired meanwhile | P (titled), C (untitled) | Literal rejection text, nothing stored, LG-044 not offered, LG-043 ticked and its group open. | pass |
| Retired machine stays among machines | C | The retired machine stays counted (count 2). The plan text "Gilt für 2 Geräte" is not asserted in this scenario's test. | pass (minor gap, see remarks) |
| Unknown machine in forged change | C | Unknown ID, non-ID and doubled ID are rejected as a whole, nothing stored. | pass |
| Change that changes nothing | P (titled), C (untitled) | No version change, no event, due dates unchanged, landing text "gilt jetzt für 2 Geräte." | pass |
| Removing every machine | P, C | "Gilt für kein Gerät" and the confirmation literal. | pass |
| No machine registered yet | P | Text, "Gerät erfassen" link to `/team/machines/new`, no form. | pass |
| Machines of a removed task never change | C | Rejected with `maintenance-task-unknown`, no event. | pass |
| Helpers cannot change | C, E | The command rejects a helper and a visitor (`not-authorized`); E checks that helpers are redirected and that nothing is offered. The "not offered" part is only checked via redirect of the page. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Conventions paragraph written | yes | `.claude/skills/engineering-conventions/SKILL.md`: "Changing the machines of a task: a versionless set delta" plus updated lines on GroupedChoice, confirmation exception and the version rule. The PR must name it (not yet open). | OK, PR text pending |
| 360 px | yes | E asserts page width ≤ 360 on the task page and the form page | OK |
| Journal entry | yes | `EVT-MachinesOfMaintenanceTaskChanged` with IDs (C); no event for a no-op, by design (G33) | OK |
| Texts from catalogs | yes | `src/platform/messages/team/maintenance.ts` changed; tests read German literals | OK |
| No personal data in logs | yes | The journal holds machine IDs and the actor ID only | OK |
| List performance | n/a | No new list; one extra count on the existing plan | OK |
| No-JS | yes | E "without JavaScript" passes | OK |
| Advisories | n/a | No dependency change | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Task page for a removed task: URL of `geraete-aendern` opened directly | "„Geräte ändern“ is not offered" for removed tasks; the page test only covers the form with `removed`, not the offered link on the task page | question, minor (no test of "not offered" on the task page for a removed one) |
| Machine Not on display added: due on its return (HS-20) | Story context | The E tests use Not on display machines, but nothing asserts the return behaviour; covered in ST-094 – minor |
| Long task name in the heading "Geräte ändern · <name>" at 360 px | G34 | Not tested; minor |
| English visitor pages | n/a – team page, German only | none |
| A task with 0 machines and "Gilt für kein Gerät" while all machines are retired | covered | none |
| "A retired machine stays among the machines" – plan count "Gilt für 2 Geräte" | In the scenario | Add one assert (HTML of the plan) to the C test; under an hour, fix in this story (minor) |
| Same-time changes of the same machine in both directions (Tom adds, Eva removes) | Row lock serializes; outcome is order-dependent | question, no rule |
| A forged `seen` with machine IDs that are not on the task | None | question, harmless (no-op or removal of what is named) |

No finding meets the follow-up hurdle.

## Verdict
accepted with remarks

Remarks (all minor, fixable in the story): (1) the scenario "A retired machine stays among the machines" does not assert "Gilt für 2 Geräte" on the plan; (2) "Geräte ändern" not offered on a removed task's page has no explicit test; (3) the pull request must name the conventions paragraph; (4) the SKILL.md line about `openWithChoice` has one over-long line (formatting only).

# Acceptance – ST-097: Choose a new machine's maintenance tasks when registering it
Date: 2026-10-29 · Tests run: `npx vitest run -t "ST-097"` → 7 passed; `npx playwright test e2e/register-machine-maintenance.spec.ts` → 5 passed (the two logged `ECONNRESET` WebServer lines are aborted requests on navigation, not failures); `check-scenarios.ts ST-097` → 12/12 covered · Preview: none (browser tests need the local technician)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| A machine is registered with its maintenance tasks | `register-with-tasks.integration.test.ts` | Fixed clock 10 June 2026, runs through `formRunner` and the Maintenance-exported command; asserts LG-042, due since "2026-06-10", wax not applying, journal actor = Tom (literals) | pass |
| Tasks of the same kind are proposed and the line says why | `e2e/register-machine-maintenance.spec.ts:82` plus the proposals test (exact line, singular, ordering) | With JS the three ticked, joysticks not, line with the ticked count (the e2e database holds earlier EM tasks); exact "3" wording in the integration test | pass |
| Untouched proposals follow a change of the machine model | e2e :110 | Fireball, own tick on Switch test, switch to DMD: all three Then lines asserted | pass |
| Without JavaScript nothing is proposed | e2e :180 | JS off; no ticks, no line, no "Alle auswählen"; ticks and registers, verified on the change page | pass |
| A task that applies only to retired machines is not proposed | integration (`loadRegistration`) | Retired LG-007; offered but `proposals[fireball]` undefined. Tested on the data, not the DOM, which is acceptable because the ticking is a pure function of proposals | pass |
| A machine can be registered without maintenance tasks | integration | Registers with none ticked; no tasks, no new journal events | pass |
| Registered as not on display becomes due on return | integration | Not due on 10 June, return on 20 June through the real status command, due since "2026-06-20" | pass |
| A task removed meanwhile rejects the whole registration | integration | Exact German text, no machine, journal grew only by the removal, removed task not offered, other ticked and open, values kept | pass |
| An unknown task in a forged registration rejects it | integration | Error, German text, no machine, journal unchanged | pass |
| A rejected registration keeps the ticks and proposes nothing again | e2e :132 (and the integration test for no policy run) | Museum number "42", error text, ticked group open, unticked stays unticked, no line, no machine | pass |
| An empty maintenance plan says so | integration | Text shown and registration works | pass |
| Helpers are still not offered registering | e2e :163 (rejection in the untitled integration test) | Link missing, page redirects, Server Action returns not-authorized and changes nothing | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Conventions paragraph on the actor of a command another module runs | yes | `SKILL.md`, "The actor of a command another module runs in the same step" (`run` versus `trigger`, `withPolicyInput`); the PR must name it | OK |
| 360 px | yes | e2e :82 asserts `pageWidth <= 360` | OK |
| List pages fast | n/a (form) | – | – |
| Journal entry per command | yes | One `EVT-MachinesOfMaintenanceTaskChanged` per chosen task, in the same transaction (tests) | OK |
| Texts from the catalogs | yes | `src/platform/messages/team/maintenance.ts` extended | OK |
| No personal data in logs | yes | No logging added | OK |
| Advisories | n/a | – | – |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Machine model changed back and forth, or the same model re-chosen | G6a/Context: untouched ticks follow | question; the scenario covers one change |
| Task removed meanwhile and also a museum-number error | "Any rejection keeps every tick" | covered by the same mechanism; no action |
| Two registrations of the same museum number at once | ST-007 | out of scope here |
| Long task names or many tasks at 360 px | G27 | width checked once; fine |
| Proposal when the model's machines are all retired or Not on display | rule: only non-retired machines | the data test covers retired; Not on display counts as non-retired, as written |
| Task chosen twice (forged) | none | handled and tested (untitled test) |
| Helper's forged post | story scenario 12 | rejected and tested |

No gaps meeting the follow-up hurdle. Known environment failures (18 Blob-limit upload tests, a `retired-machines` width flake that passes alone) are not related to this story.

## Verdict
accepted

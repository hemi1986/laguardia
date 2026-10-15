# Acceptance – ST-043: Due maintenance list grouped by maintenance task
Date: 2026-10-15 · Tests run: `npm test -- -t "ST-043"` → 9 passed, 0 failed; `npm run test:e2e -- e2e/due-maintenance.spec.ts e2e/team-shell.spec.ts --workers=2` → 6 passed; `check-scenarios.ts ST-043` → 9/9 covered · Preview: https://laguardia-hnzwq8grv-hemi6.vercel.app (not exercised: team pages need an account, none exists on the preview before ST-068)

## Scenarios
All tests are in `src/app/(team)/team/maintenance/due-maintenance.integration.test.ts`. Data is set up through the commands (`createMachineModelCommand`, `registerMachineCommand`, `changeMaintenancePlanCommand`), the day through `fixedClock`; the "When" is `loadDueMaintenance` plus `DueMaintenanceView` – the same two units the page composes.

| Scenario | Test | Given/When/Then really checked? | Result |
|---|---|---|---|
| Maintenance task becomes due | `ST-043: Maintenance task becomes due` | Yes. Literals for title, location, last done 2026-01-01, due since 2026-04-01; German text and link asserted in the HTML. | pass |
| Machine registered after the start date | `ST-043: Machine registered after the start date` | Yes. 1 June: no task, no "LG-061" in the HTML. 15 Aug: last done 2026-05-15, due since 2026-08-15; 14 Aug: nothing due. | pass |
| The list first shows each due maintenance task with its counts | `ST-043: The list first shows …` | Yes. 12/3 and 2/0 built with real machines; the HTML has the sentence "… · 12 Geräte, 3 überfällig", the task once, and no machine number. | pass |
| Due maintenance tasks are grouped … sorted by location | `ST-043: Due maintenance tasks are grouped …` | Yes. Order LG-043, LG-042, (LG-045), LG-044 plus instruction and helper mark. The extra LG-045 ("row 10") is added on purpose to cover numeric sorting. | pass |
| Nothing is due | `ST-043: Nothing is due` | Yes. `tasks: []`, `chosen: undefined`, sentence present, no task or machine name in the HTML. | pass |
| Filter suitable for helpers | `ST-043: Filter suitable for helpers` | Mostly. The filtered result and the checked checkbox are asserted. "Both are due" is only implied, because the unfiltered list is never asserted (see remarks). | pass |
| Overdue after 25 % of the interval | `ST-043: Maintenance task becomes overdue …` | Yes. 1 March not overdue (no "Überfällig" in the HTML), 2 April not overdue, 3 April overdue (92 days). Literals. | pass |
| Restriction decides which machines are listed | `ST-043: Restriction decides …` | Yes. Only LG-005 (EM) is listed, not the DMD machine. | pass |
| Retired machines and removed maintenance tasks are not listed | `ST-043: Retired machines and removed …` | Yes, with stand-ins (`retireMachineForTest`, `removeMaintenanceTaskForTest`). A control task and a control machine show the exclusion is selective. | pass |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | The browser test checks the empty list for width ≤ 360 px. The chosen-task view (machine cards) is not checked in a browser. Layout is one column, `[overflow-wrap:anywhere]`, no tables. | OK with remark |
| List pages fast with realistic data | yes | One query for non-retired machines plus the plan, then in-memory calculation. About 60 machines × 19 tasks is trivial. No pagination needed (G4a splits the list). | OK |
| Every command writes its journal entry | n/a | Read-only page, no command. | n/a |
| Texts from the message catalogs | yes | `teamMessages.dueMaintenance` and `terms` in `team.de.ts`; no literal text in the components. | OK |
| No personal data in logs | n/a | No logging added. | n/a |
| Role access | yes | `requireTeamMember()`: every team member, as in G19 row 5; navigation entry added and covered by `team-shell.spec.ts`. | OK |
| Module boundaries / composition | yes | Collection publishes `machinesForMaintenance`; the page composes both modules and Maintenance receives the machines (context map); lint and types are `verify.ts`'s part, not re-run here. | OK |

### UX guidelines (this is the UX check)
| Rule | Finding | OK? |
|---|---|---|
| G4a groups first with counts | Tasks first as "Name · 12 Geräte, 3 überfällig"; machines only after choosing; asserted in scenario 3. | OK |
| G6a singled out says why | Overdue is shown as the word "Überfällig" on the machine and as "n überfällig" on the task; no colour-only signal. The task order (most overdue first) is visible through the counts. | OK |
| G7 empty | Says in words that nothing is due, with a variant for the helpers filter. There is nothing to do in the empty case, so "what to do" is satisfied by the statement. | OK |
| G16 360 px, one column, no tables | One column, `Page wide`, no tables. Machine cards are not browser-tested at 360 px. | OK, remark |
| G19 row 5 | "Wartung" in the line, everyone. | OK |
| G17 reachable and leaveable | Reached from the navigation. In the machine view the only way back is the link "Alle fälligen Wartungen" at the **bottom** of the list; with ~60 machines that is far down. The navigation is still there, but "Wartung" while on /team/maintenance?task=… is the only other way back. | remark |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Way back from a chosen task is at the bottom of a long machine list | G17 (every page has a way back) – partly met by the nav link | fix now: put the back link above the machine list (a few lines) |
| Touch targets: task entries and museum-number links are plain text-sm links, 12 px gap | no numeric tap-size rule in the guidelines | question for the ux owner; the whole task row is the link, so it is acceptable |
| Chosen-task view at 360 px with realistic machine data not browser-tested (no machine is due in e2e since all are registered today) | DoD 360 px | fix now if cheap: a view-level check cannot test width; accept as known limitation until ST-044/ST-068 allow due data in e2e |
| Scenario 6 does not show that both tasks are due before filtering | Gherkin Given | fix now: one assertion of the unfiltered `tasks` list |
| Retire/remove scenario relies on test stand-ins | n/a | question: when ST-039/ST-041 land, replace the stand-ins with the real commands (note it in those stories) |
| Unknown, stale, or filtered-out `?task=` silently shows the task list | none | question; arguably fine (a task that is no longer due simply disappears) |
| Machines *Not on display* stay listed | Story Context: until ST-056 | none – decided by the user 2026-10-15 |
| Registration date → calendar date depends on the time zone convention (a machine registered around midnight) | ST-003 time convention | question: confirm `calendarDate()` uses the museum time zone |
| Task name or location very long | none | covered by `overflow-wrap:anywhere`; not tested |
| English visitors / other roles | The page is team-only, German only; helpers and technicians both allowed | none |
| Concurrent use | Read-only, computed on read | none |
| Default 4 Playwright workers time out 2 random browser tests (also on `main`) | n/a | known, not caused by ST-043; `--workers=2` all pass |

## Verdict
**accepted with remarks.** All 9 scenarios have a real test that passes, the e2e specs pass, and no rule of the story or the UX guidelines is violated. Nothing reaches the follow-up hurdle; the remarks (back link above the list, unfiltered assertion in scenario 6, replacing the stand-ins in ST-039/ST-041, preview not checked because of the missing account) can be handled in this story or are tracked in existing stories.

## Disposition (`/implement`, 2026-10-15)

- **1 fixed** – „Alle fälligen Wartungen“ sits above the chosen task's machines (G17).
- **2 fixed** – the filter scenario asserts first that both tasks are due unfiltered.
- **3** – the stand-ins are replaced when ST-039 and ST-041 bring the real commands (both stories touch this list).
- **4** – see code review #7: revisit with ST-044.
- **5** – tap sizes: no guideline sets one; left to the UX owner.
- Questions: `calendarDate()` uses Europe/Berlin (ST-003 time convention) – a machine registered at 23:30 Berlin time counts for that Berlin day. An unknown or stale `?task=` shows the list of tasks – intended (a task that is no longer due has no machines to show).

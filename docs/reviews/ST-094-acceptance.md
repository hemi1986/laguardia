# Acceptance – ST-094: Maintenance tasks apply to the machines a technician chooses, due at once on each
Date: 2026-10-26 · Tests run: `npm test -- -t "ST-094"` → 23 passed, 0 failed (7 files); `vitest run` on maintenance-plan, modules/maintenance, _actions → 84 passed; `check-scenarios.ts ST-094` → 22/22 covered · Preview: none (browser spec `e2e/maintenance-plan-machines.spec.ts` NOT run by me – it needs the local e2e technician and a running app)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Adds a task with its machines | change-maintenance-plan-command.integration.test.ts | Yes: real command, count 2, due only on the two chosen (not the third), both journal events, no typed text in journal. „Gilt für 2 Geräte“ asserted as `machineCount: 2`, not the German text (text is asserted for 1 and 0 elsewhere) | pass |
| Due at once on every chosen machine | due-maintenance.integration.test.ts | Yes | pass |
| Each machine's interval runs on its own | same | Yes | pass |
| A task for no machine | command test | Yes (count 0, not due, only one event) | pass |
| Grouped, ordered, closed | new/machine-choice.integration.test.ts | Yes: literal headers in order, no Solid-State/LCD, none open, machine order, no "Alle auswählen" in server markup | pass |
| Whole group only with JavaScript | e2e/maintenance-plan-machines.spec.ts (two tests, same title: JS off / JS on) | Reads right: JS off has no button and count stays 0; JS on ticks the group, header follows. Uses the dev group's real total, not a fixed 6. Local only, not run by me | pass (unrun) |
| Retired not offered, not on display says so | machine-choice test | Yes | pass |
| No machine registered yet | machine-choice test | Yes: empty text, both cases (none / all retired), task can still be added, „Gilt für kein Gerät“ | pass |
| Not on display becomes due on return | due-maintenance test | Not read line by line; passes, title matches | pass |
| Rejected task keeps machines, opens groups | e2e (JS off) + grouped-choice.test.ts | Yes: ticked, name and interval kept, EM open, Arcade closed, reason shown | pass (e2e unrun) |
| Interval must be positive | command test | Code `interval-not-positive`, nothing stored. "LG-005 still ticked" is not asserted here (covered only by the generic keep-choice test) | pass |
| Machine retired meanwhile rejects the whole step | command test + `retiredAmong` test | Command level yes (error code, nothing stored, version unchanged). **The text „LG-044 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“, and that LG-005 stays ticked with its group open, is not asserted anywhere** (`addRejectionText`, the action's `retired` handling) | pass, partial |
| Unknown / doubled machine in a forged step | command test | Codes `unknown-machine`, `machine-chosen-twice`, nothing stored. **The text „Dieses Gerät gibt es nicht. …“ is not asserted** | pass, partial |
| Machine retired later no longer counts | due-maintenance test | Yes: count 2→1, „Gilt für 1 Gerät“, off due list, not offered for several | pass |
| Forms have no restriction and no start date | maintenance-plan/forms.test.ts | Yes, both forms rendered | pass |
| Recorded only on a machine the task applies to | record-maintenance-command.integration.test.ts | Not read line by line; passes | pass |
| Recording for several offers the task's machines | due-maintenance test | Yes: LG-042 due, LG-045 other, LG-050 absent | pass |
| Model correction changes nothing | due-maintenance test | Passes; title matches | pass |
| Migration – existing tasks apply to today's machines | migrations.integration.test.ts | Yes: runs real migration from 0031, EM only (not DMD, not retired), plan count, journal count unchanged | pass |
| Migration – done record keeps its due date | same | Yes (due 1 Mar 2027 boundary, record stays) | pass |
| Migration – no done record is due at once | same | Yes (added 2025-12-31T23:00Z = midnight Berlin, due since 1 Jan 2026) | pass |
| Helpers cannot add | command test (`not-authorized`) | Action rejected: yes. "Plan not offered to helper" is covered by the unchanged e2e `maintenance-plan.spec.ts` and a page test, not by this title | pass |

Superseded scenarios: all 14 listed in `docs/stories/superseded-scenarios.json` match the story's list (ST-036 2, ST-040 6, ST-041 3, ST-043 3). `check-scenarios.ts` validates the file. Kept scenarios (ST-044, ST-045, ST-041 interval, ST-043 overdue, ST-040 helpers) still exist and pass.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| 360 px | yes | e2e checks `pageWidth <= 360` on the form (JS off and on) and on the plan; not run by me | yes (unverified by me) |
| List pages fast with realistic data | partly | Form lists all non-retired machines; one grouped query (`groupMachines`). No volume test | question below |
| Journal entry per command | yes | Both events asserted; the add with no machines writes only `EVT-MaintenancePlanChanged`; migration writes none (tested) | yes |
| Texts from the message catalogs | yes | `teamMessages.maintenancePlan.machines`; German literals in tests only | yes |
| No personal data in logs/journal | yes | Journal holds IDs only; asserted that the instruction is not in it | yes |
| Next.js/React advisories | no | not touched | n/a |
| Conventions get the paragraphs (story DoD) | yes | SKILL.md: how superseded scenarios are treated (Tests section + `check-scenarios.ts`), several-machine journal event (Journal section), plus GroupedChoice, `many` form, machines of a task, data migration | yes |
| PR lists superseded scenarios and changed tests | yes | Not checkable yet – the PR does not exist. The reviewer should check it names each change with its reason | open |
| Retirement lock in machine-ID order | yes | Described in conventions; no test of the deadlock order | remark |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Two technicians add tasks with overlapping machines at once | Story note: shared retirement lock in machine-ID order, no deadlock. Not tested | question: one concurrency test would be cheap, but not required by a scenario |
| Migration: a backdated record (date before the floor) recorded after the floor midnight did not count before, but counts now under "recorded since added" and can move the due date | Migration rule only protects records that counted before | question to the user/lead dev – only dev and preview data exist, so low impact |
| Migration tested only with a start date, registration date and one record; the "model correction" branch of the floor and the "earlier of" branch (b) have no test | Story lists (a)/(b) as the rule | minor: add a test for branch (b) and a corrected model |
| Form with hundreds of machines (long list, 360 px, all groups open after a rejection) | G27 | question |
| Machine returns from Not on display: due "from the day of its return" tested; machine retired while Not on display | "A retired machine never counts" | covered by the retired rules |
| Long task name / machine title in the checkbox label at 360 px | none | question, not a bug |
| English UI: the form is team-only, German only | CLAUDE.md rule | n/a |
| Unknown-machine / retired-meanwhile texts on the real form (action + client form) | Story: exact texts and kept choice | **minor**: add one test of `addMaintenanceTaskAction` (or `addRejectionText` plus a render with `chosen`) with a retired machine |

## Findings
- No violated rule and no failing test.
- Minor 1: the scenario lines „LG-044 ist inzwischen ausgemustert. Es wurde nichts gespeichert.“, „Dieses Gerät gibt es nicht. …“ and "LG-005 still ticked, group open" after a machine-retired rejection are not asserted at page or action level. The code exists (`add-rejection-text.ts`, `retiredAmong`, `GroupedChoice` with `chosen`), and its parts are tested separately.
- Minor 2: browser spec runs locally only and I did not run it, so the JS-on/JS-off scenarios and 360 px check are unverified by me. Run `npm run test:e2e -- maintenance-plan-machines` before the push.
- Minor 3: the migration's branch (b) and the model-correction branch have no test.
- Neither meets the follow-up hurdle, so no new stories.

## Verdict
accepted with remarks

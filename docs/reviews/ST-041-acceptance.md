# Acceptance – ST-041: Maintenance plan – change or remove a maintenance task
Date: 2026-10-23 · Tests run: `npm test -- -t "ST-041"` → 13 passed / 0 failed (3 files); `npx playwright test e2e/maintenance-plan.spec.ts` (local) → 5 passed · `check-scenarios.ts ST-041` → 9/9 covered · Preview: none

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Technician changes the interval | `due-maintenance.integration.test.ts` | Given: 3 months, done 2026-01-01 on LG-042. When: real command. Then: LG-042 `dueSince` literal 2026-03-01, plus "geändert" text on the plan page. | pass |
| Technician changes the suitable-for-helpers mark | `due-maintenance.integration.test.ts` | Not listed for helpers before; after the change the plan and the due list (task chosen) show the mark. | pass |
| Technician removes a maintenance task | `due-maintenance.integration.test.ts` | Records on two machines (done, partially done); gone from plan; not due in 2027 or 2030; both records kept; confirmation text asserted. | pass |
| Removing asks once | `e2e/maintenance-plan.spec.ts` (no JS) | Question text literal; the form is replaced; "Zurück" keeps typed values and nothing is removed; only "Entfernen" removes. Width at most 360 px asserted. | pass |
| Narrowed restriction removes machines from the due list | `due-maintenance.integration.test.ts` | LG-042 (DMD) and LG-005 (EM) are due. After the change only LG-005 is listed; the record of LG-042 is kept. | pass |
| Changing the start date | `due-maintenance.integration.test.ts` | LG-042 without a done record is due 2027-04-01; LG-043 (done 2026-05-01) due 2027-05-01; the not-yet-due day before is asserted too. Matches the revised scenario. | pass |
| Invalid change is rejected | `change-maintenance-plan-command.integration.test.ts` | Arcade+EM gives `technology-does-not-fit-machine-category`; the old restriction is kept. | pass |
| The interval must stay positive | same file | 0 gives `interval-not-positive`; the interval stays 3. | pass |
| Helpers cannot change the maintenance plan | same file, plus form-runner test | Change and remove both give `not-authorized`; the task is unchanged. The form runner ignores a forged `role` field. | pass |

Remarks: the "Removing asks once" scenario is covered only by the no-JS browser test, which is the real entry point. It does not run in the integration suite (fine). No test checks that a helper who opens `/team/maintenance-plan/<id>` directly is sent away; the ST-040 helper e2e covers only the plan address. The page calls `requireTechnician()` as the ST-040 pages do, so this is low risk.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | Width asserted in the change form and the question (e2e). | OK |
| List pages fast with realistic data | partly | No new list; the plan page is unchanged in kind. | OK |
| Every command writes its journal entry | yes | Journal test: `added`, `changed` entries. The remove journal entry is not asserted directly (only the change entry is). | OK, remark |
| Texts from message catalogs | yes | `teamMessages.maintenancePlan.*` (changed, removed, removeQuestion, ...). | OK |
| No personal data in logs/journal | yes | The journal holds only the task ID and the change kind; the test asserts the instruction text is absent. | OK |
| Advisories | n/a | No dependency change. | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Two technicians change the plan at once (version conflict on the change or remove form) | Plan version (HS-16); ST-040 tests this for add only | Question: is the rejection text for `version-conflict` shown on the change form and does it keep the typed values? Covered by the generic form runner. No action |
| Opening the change form of a removed or unknown task (e.g. an old bookmark) | "A removed maintenance task never becomes due again"; the page shows "nicht im Wartungsplan", no form | OK, no test seen; question whether a page test is wanted |
| Removing a task twice (second tab) | Command test gives `maintenance-task-unknown` with German text | Covered |
| Changing the start date to a day after the latest done record, or into the future | ST-044 rule (later of latest done and start date) | Follows the rule; the story's scenario covers the earlier-record case only. Question |
| Restricting a task so that machines with open "partially done" records leave the list | Story: records kept | Covered |
| Instruction or name very long on the 360 px list | No rule | Question, not a bug |
| Name not changeable | Deliberate (note from caller) | Not a gap; the story text does not list the name |
| Removed task whose name is reused by adding a new one | None | Question: allowed? Records stay with the old task ID |
| English language | Team pages are German only | n/a |

## Verdict
accepted with remarks

Remarks (none block):
1. Add a test for a helper opening the change-form address directly, and for the journal entry of a removal.
2. The preview URL was not available; acceptance on the preview deployment is still open.

## Resolution (implementation, 2026-10-23)
- Remark 1 fixed: `e2e/maintenance-plan.spec.ts` sends a helper away from a change form's address too.
- Remark 2 fixed: the command test asserts the journal entry of a removal (`change: "removed"`, no text).
- Remark 3: acceptance on the preview follows with the pull request.

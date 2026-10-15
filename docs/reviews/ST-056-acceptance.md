# Acceptance – ST-056: Due maintenance for machines not on display and returning to display
Date: 2026-10-15 · Tests run: `npm test -- -t "ST-056|ST-044"` → 23 passed, 0 failed (4 files; `check-scenarios.ts ST-056`: 4/4 covered) · Preview: none (nothing is due on the preview, no browser test)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Machines not on display are never due | `due-maintenance.integration.test.ts` | Given: LG-030 set to not-on-display through CMD-ChangeMachineStatus, task last done 2024-06-01 (two years before the fixed date 2026-06-10). When: the page data and rendered HTML of the due list. Then: no tasks, "LG-030" absent, empty-state text shown. Real entry point. | pass |
| Task already due at the return counts from the return date | same | Given: 1-month task, last done 2025-05-01, off display for a year. When: change to playable on 2026-06-01 through the command. Then: literals `dueSince: "2026-06-01"`, `lastDone: "2025-05-01"`, not overdue on 1 and 8 June, overdue on 9 June (= 8 days after). All Then lines asserted with literals. | pass |
| Task not yet due at the return follows the normal rule | same | Given: 12-month task recorded 2026-03-01 while off display (CMD-RecordMaintenance). When: playable on 2026-06-01. Then: not listed on 1 June 2026 or 28 Feb 2027, listed with `dueSince: "2027-03-01"` on 1 Mar 2027. | pass |
| Going off display removes a due task from the list | same | Given: LG-042 listed as due (asserted first). When: change to not-on-display. Then: gone from the task's list and from the page's task list. | pass |

ST-044 "Maintenance on a machine not on display counts" (`record-maintenance-command.integration.test.ts`): still matches its story. It still records on a not-on-display machine and asserts the record, then brings the machine back on 1 July (needed, because it is now never due while off display) and checks the interval from the record day (not due 9 Sep, due 10 Sep). The scenario's "interval counts from that day" is still checked, only through the return. Passes.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | No – no new UI, only which rows the existing list contains | diff touches no component | n/a |
| List fast with realistic data | Yes | the return date is one correlated subquery per machine inside the existing single machines query; no per-machine round trip. No measurement was taken. | ok (remark: no measurement) |
| Command writes its journal entry | No – no new command | read-side only | n/a |
| Texts from the message catalogs | Yes | no new texts; the empty state is the existing one | ok |
| No personal data in logs | Yes | nothing logged | ok |
| Browser test | Not possible | nothing is due on preview or e2e data; the domain behaviour is tested against an isolated database at page-data and HTML level | accepted |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Machine goes off display, returns, goes off again and returns again | HS-20 "return" – the code takes the latest return (`max(changedAt)`); not tested | question; low risk, can be one test in this story |
| Return from "not on display" to another non-playable status (e.g. out of order) | Code counts any status away from not-on-display as a return; the story says "set to Playable" | question – plausible and consistent with "back on display" |
| Machine registered directly as Not on display, first change is the return | Not stated; code handles it (previous status in the history) | fine, optional test |
| Return timestamp near midnight (calendar date derived from a timestamp; time zone Europe/Berlin vs UTC) | `calendarDate` is used for other dates the same way | question – check `calendarDate` uses the museum's time zone |
| A record "done" after the return on a task already due at the return | Normal rule via last done (dueDate is later than the return, so normal dates) | fine |
| Task added after the return with a start date earlier than the return | Not stated; it counts from the return date | question, low risk |
| Retired machine that was off display | ST-043 rule: retired never due; query excludes it | covered by ST-043 |
| Helper vs technician permission for the status change | ST-012 | out of this story |

None of these meets the follow-up hurdle.

## Verdict: accepted
All four scenarios have a real test that checks Given, When (through the actual command and page data) and Then with literals; tests pass; the ST-044 scenario still matches its story. Remarks: no performance measurement of the added subquery; the questions above (repeated return, return to a status other than playable, midnight time zone) can be settled in this story or left.

## Disposition (`/implement`, 2026-10-15)

- A second return, a return to another status than Playable, the Berlin day of a return near midnight, a task added after the return with an earlier start date: all follow from the rule as built – the latest change away from Not on display, any displayed status, `calendarDate` (Europe/Berlin), and "already due at the return". No change; the grace-day reading is documented (code review #1).

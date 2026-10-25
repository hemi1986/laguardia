# Acceptance – ST-057: Number of overdue maintenance tasks in the machine overview
Date: 2026-10-25 · Tests run: `npm test -- -t "ST-057"` → 2 passed, 0 failed · `check-scenarios.ts ST-057` → 2/2 covered · Preview: none (checked through tests and code)

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Machine overview shows the number of overdue maintenance tasks | `src/app/(team)/team/machines/machine-overview.integration.test.ts` | Given: two real maintenance tasks, LG-042 never maintained (overdue), LG-043 recorded done through `recordMaintenanceCommand` on 2026-10-01 (fixed clock 2026-10-04, so not overdue). When: `overview()` renders the page's data and component. Then: literal "2 Wartungsaufgaben überfällig" on LG-042; LG-043 entry exists and has no "Wartung" (zero not shown). All lines asserted. | OK |
| Recording removes the task from the count | same file | Given: 2 overdue tasks, asserted first. When: `recordMaintenanceCommand` outcome done, through the real command. Then: "1 Wartungsaufgabe überfällig" (singular) and no "2 Wartungsaufgaben". | OK |

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | Yes (text added to the existing entry's detail line) | Reuses the existing detail list of the entry, as with "offene Defekte" | OK, not verified in a browser (no preview) |
| List pages fast with realistic data | Yes | `overdueMaintenanceCounts` runs the full RM-DueMaintenance once per page load (tasks × machines, one query for last-done), not per machine. No performance test. | OK, remark below |
| Journal entry per command | No (read model only) | – | n/a |
| Texts from message catalogs | Yes | `collectionTexts...overdueMaintenance` in `src/platform/messages/team/collection.ts`, singular/plural per story wording | OK |
| No personal data in logs | Yes | No logging added | OK |
| Advisories | Not touched | No dependency change | OK |
| Same overdue rule as ST-043/ST-056 | Yes | Count is derived from `dueMaintenance` (`machine.overdue`), so Not on display and return rules are shared | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? (cite) | Recommendation |
|---|---|---|
| Machine *Not on display* with overdue tasks | Never due (ST-056, `dueOn`), so no count; follows from the shared code, no test in this story | Fine; ST-056 covers the rule |
| Retired machine shown under "all machines" / search | Retired machines are not published for maintenance, so no count; consistent with "never due" | Question: confirm that is intended (no count on retired entries) |
| Helper (role) opens the overview | `dueMaintenance` is called without the team member, so the count includes tasks a helper may not record. Story says nothing about role limits | Question: fine for an information count? |
| Count is computed for all machines, then looked up for the listed ones | No rule | Minor: cost grows with machines × tasks on every overview load; fine for museum scale |
| English page | The team area is German only | n/a |
| Other pages' counts (e.g. due-not-overdue) | Out of Scope in the story | n/a |

## Remarks
- Minor, no action needed: the diff contains unrelated prettier reformatting in `datei-anhaengen/attach-file-form.ts`, `stickers/qr-sticker.test.ts`, `stickers/sticker-sheet.tsx` and `stickers.integration.test.ts` (some of it only needed because `loadMachineOverview` now takes a clock). Harmless, but it dilutes the diff.
- No finding reaches the follow-up hurdle.

## Verdict
accepted

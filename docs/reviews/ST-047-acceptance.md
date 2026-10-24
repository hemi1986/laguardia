# Acceptance – ST-047: Maintenance on the machine record
Date: 2026-10-24 · Tests run: `npm test -- -t "ST-047"` → 17 passed, 0 failed (2 files); `check-scenarios.ts ST-047` → 8/8 covered; `verify.ts --e2e` passed (reported by caller) · Preview: none (checked against tests and local code)

Approved deviations (user, 2026-10-24): dates in ST-043's format („fällig seit 03.06.2026“); the page „Wartungseinträge · LG-042“ always lists all records with a heading per year and its count, no year chooser.

## Scenarios
| Scenario | Test (file) | Given/When/Then really checked? | Result |
|---|---|---|---|
| Machine record shows maintenance records | `machine-record-maintenance.integration.test.ts` | Given via real commands (Ben partially done with note 2 June, Anna 10 June). When: loads the record and renders the view. Then: task, outcome, who · date, note and the order are asserted with literals. | OK |
| Only the 5 latest ... | same | 7 records via the command; the 5 newest in order, link text „Alle Wartungseinträge (7)“ with href; the all-page data and view show all 7 newest first, title, year heading "2026 · 7 Einträge", „Zurück zum Gerät“ link. Page route itself (`page.tsx`) is not rendered, only loader and view. | OK |
| Machine record shows due and overdue ... | same | Plan with start dates and a fixed clock. Asserts „fällig seit 03.06.2026“, no marker on Clean playfield; Wax has its due date and „Überfällig“. | OK |
| Recording maintenance from the machine record | same | Helper Anna through the form runner, real command; offer link `von=geraet` checked; record stored; landing address is the machine record, confirmation „Wartung an LG-042 eingetragen.“ derived from the journal (`loadMachineConfirmation`); task no longer due. | OK |
| A rejected recording still leads back ... | same | Date 8 days back is rejected with `date-too-early`; typed outcome and note returned; nothing stored, no redirect; the form view with `back: "machine"` has „Zurück zum Gerät“ to `/team/machines/LG-042`. Binding of `back` from `?von=` is in `page.tsx`, covered only by the e2e URL and the unit test of `recordMaintenanceReturnOf`. | OK |
| Helpers record only ... suitable for helpers | same | Anna sees both as due; „Wartung erfassen“ only on the suitable one. | OK |
| Machines not on display show nothing due | same | Real status change to not-on-display; no task, no „fällig seit“/„Überfällig“; the not-on-display text; old record still shown. | OK |
| Nothing due and nothing recorded says so | same | Both empty texts asserted literally. | OK |

Extra: `record-maintenance-address.test.ts` covers the fixed return choice (foreign URLs and arrays fall back to the list; no open redirect). `e2e/due-maintenance.spec.ts` covers the flow without JavaScript, including a 360 px width check.

## Definition of done
| Item | Applies | Evidence | OK? |
|---|---|---|---|
| Usable at 360 px | yes | e2e asserts page width ≤ 360 on the form and the machine record; `[overflow-wrap:anywhere]` on long texts | OK |
| List pages fast with realistic data | partly | all-records page loads once per machine (one query plus one names lookup); the record shows 5 | OK |
| Command writes its journal entry | yes (unchanged ST-044 command) | the confirmation reads the journal | OK |
| Texts from the message catalogs | yes | `machineMaintenance` in `messages/team/maintenance.ts`; no hard-coded German in the components checked | OK |
| No personal data in logs | yes | no logging added | OK |
| Critical advisories | not part of this story | – | n/a |
| No open redirect | yes (story rule) | `recordMaintenanceReturnOf` fixed choice; landing address built on the server from the machine ID | OK |

## Edge cases not covered by the story
| Case | Expected by a rule? | Recommendation |
|---|---|---|
| Retired machine: the all-records page loads it (`retiredToo`); the machine record may not | no rule found | question (low) |
| The e2e opens the form by URL, not by clicking „Wartung erfassen“ on the machine record; the link's href is covered by the integration test | no | accept as is |
| Helper opens the form by URL for a task not suitable for helpers | G11 – the command refuses (ST-044) | covered by ST-044 |
| `?maintenanceRecorded=` of a record from another machine or another person | story: derived on the server | handled (checks machine and journal) – no test for the foreign-machine branch; optional unit test |
| More than 5 records on one day / several years on the all-page | decided: grouping by year | covered in view; no test for several years (optional) |
| English locale | team pages are German only | none |
| Machine with many due tasks | none | no limit set; fine for now |

No finding passes the follow-up hurdle; nothing needs a new story.

## Verdict
accepted with remarks – remarks: `page.tsx` of the new route and the binding of `?von=` are not rendered by a test (only e2e by URL); no test for the foreign-machine confirmation branch or for the year grouping across several years. All are optional hardening, not blocking.

## Refactor (2026-10-24, `/implement`)
- **Remark 2 fixed:** new tests check that a maintenance record is confirmed only on its own machine, only for the team member who recorded it, and not for an address that is no ID (the page now checks `isId` first); and that the records page groups several years, the newest first.
- **Remark 1 skipped:** the routes are thin, and the browser test runs the form route with `von=geraet` end to end. Nothing is due on the e2e machines, so it can't click the link.
- **Remark 3:** a retired machine's record shows its maintenance records, and section 5 says nothing is due. Revisit when a story decides otherwise.
